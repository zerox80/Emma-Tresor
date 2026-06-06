#!/usr/bin/env bash
set -euo pipefail

SNIPPET_PATH="/etc/nginx/snippets/bunny-real-ip.conf"
NGINX_TEST_CMD="nginx -t"
NGINX_RELOAD_CMD="systemctl reload nginx"
BUNNY_IPV4_URL="https://bunnycdn.com/api/system/edgeserverlist"
BUNNY_IPV6_URL="https://bunnycdn.com/api/system/edgeserverlist/IPv6"
DRY_RUN=false
NO_RELOAD=false

usage() {
    cat <<'EOF'
Usage: update_bunny_real_ip.sh [options]

Options:
  --snippet-path PATH     Write the Nginx snippet to PATH.
  --nginx-test-cmd CMD    Command used to validate Nginx config.
  --nginx-reload-cmd CMD  Command used to reload Nginx.
  --ipv4-url URL          Bunny IPv4 edge-server-list URL.
  --ipv6-url URL          Bunny IPv6 edge-server-list URL.
  --dry-run               Print generated snippet to stdout; do not write/test/reload.
  --no-reload             Write and test config, but do not reload Nginx.
  -h, --help              Show this help.

Examples:
  sudo bash update_bunny_real_ip.sh
  bash update_bunny_real_ip.sh --dry-run
  bash update_bunny_real_ip.sh --snippet-path /tmp/bunny-real-ip.conf --nginx-test-cmd true --no-reload
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --snippet-path)
            SNIPPET_PATH="${2:?--snippet-path requires a value}"
            shift 2
            ;;
        --nginx-test-cmd)
            NGINX_TEST_CMD="${2:?--nginx-test-cmd requires a value}"
            shift 2
            ;;
        --nginx-reload-cmd)
            NGINX_RELOAD_CMD="${2:?--nginx-reload-cmd requires a value}"
            shift 2
            ;;
        --ipv4-url)
            BUNNY_IPV4_URL="${2:?--ipv4-url requires a value}"
            shift 2
            ;;
        --ipv6-url)
            BUNNY_IPV6_URL="${2:?--ipv6-url requires a value}"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-reload)
            NO_RELOAD=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1" >&2
        exit 1
    fi
}

require_command python3

tmp_file="$(mktemp)"
cleanup() {
    rm -f "$tmp_file"
}
trap cleanup EXIT

python3 - "$BUNNY_IPV4_URL" "$BUNNY_IPV6_URL" >"$tmp_file" <<'PY'
import ipaddress
import json
import sys
import urllib.request

urls = sys.argv[1:]
seen = set()

for url in urls:
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = response.read().decode("utf-8")

    try:
        addresses = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Could not parse Bunny IP list from {url}: {exc}") from exc

    if not isinstance(addresses, list):
        raise SystemExit(f"Bunny IP list from {url} is not a JSON array.")

    for address in addresses:
        address = str(address).strip()
        if not address:
            continue

        try:
            ipaddress.ip_network(address, strict=False)
        except ValueError as exc:
            raise SystemExit(f"Invalid Bunny IP/network from {url}: {address}") from exc

        if address not in seen:
            seen.add(address)
            print(f"set_real_ip_from {address};")

if not seen:
    raise SystemExit("Bunny IP list was empty; refusing to write snippet.")
PY

if [ "$DRY_RUN" = true ]; then
    cat "$tmp_file"
    exit 0
fi

mkdir -p "$(dirname "$SNIPPET_PATH")"
install -m 0644 "$tmp_file" "$SNIPPET_PATH"

echo "Wrote $(wc -l < "$SNIPPET_PATH") Bunny real-IP entries to $SNIPPET_PATH"

if ! $NGINX_TEST_CMD; then
    echo "Nginx config test failed. The snippet was written, but Nginx was not reloaded." >&2
    exit 1
fi

if [ "$NO_RELOAD" = true ]; then
    echo "Skipping Nginx reload because --no-reload was set."
else
    $NGINX_RELOAD_CMD
    echo "Nginx reloaded successfully."
fi
