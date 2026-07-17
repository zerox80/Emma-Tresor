"""Duplicate detection actions shared by the inventory item view set."""

from __future__ import annotations

from collections import defaultdict
from itertools import combinations
from typing import Literal, cast

from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import DuplicateQuarantine, Item
from ..serializers import DuplicateCandidateSerializer


class DuplicateFinderMixin:
    @action(detail=False, methods=['get'], url_path='duplicates')
    def find_duplicates(self, request):
        """Analyze potential duplicate items based on flexible matching rules."""

        if not request.user.is_authenticated:
            return Response({'detail': 'Authentifizierung erforderlich.'}, status=status.HTTP_401_UNAUTHORIZED)

        queryset = self.filter_queryset(self.get_queryset())
        options = self._parse_duplicate_options(request)
        if not options['active_criteria']:
            return Response(
                {'detail': 'Mindestens ein Vergleichskriterium muss aktiviert sein.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        limit = options['limit']
        items = list(queryset.order_by('name', 'id')[:limit])
        if not items:
            return Response({'count': 0, 'results': [], 'analyzed_count': 0})

        quarantined_pairs = self._load_quarantine_pairs(request.user)
        groups = self._build_duplicate_groups(items, options, quarantined_pairs)

        serializer = DuplicateCandidateSerializer
        response_payload = [
            {
                'group_id': index + 1,
                'match_reasons': group['reasons'],
                'items': serializer(group['items'], many=True).data,
            }
            for index, group in enumerate(groups)
        ]

        return Response(
            {
                'count': len(response_payload),
                'results': response_payload,
                'analyzed_count': len(items),
                'limit': limit,
                'preset_used': options.get('preset_used'),
            }
        )

    def _parse_duplicate_options(self, request):
        preset = (request.query_params.get('preset') or '').lower().strip()
        if preset == 'auto':
            return {
                'name_match': 'prefix',
                'description_match': 'contains',
                'wodis_match': 'exact',
                'purchase_tolerance': 30,
                'active_criteria': True,
                'limit': self.duplicate_default_limit,
                'preset_used': 'auto',
                'require_any_text_match': False,
            }

        name_match = request.query_params.get('name_match', 'exact').lower()
        description_match = request.query_params.get('description_match', 'none').lower()
        wodis_match = request.query_params.get('wodis_match', 'none').lower()
        tolerance_raw = request.query_params.get('purchase_date_tolerance_days')
        limit_raw = request.query_params.get('limit')
        any_text_raw = request.query_params.get('require_any_text_match')

        if name_match not in self.DUPLICATE_NAME_CHOICES:
            raise serializers.ValidationError({'name_match': 'Ungültiger Wert für name_match.'})
        if description_match not in self.DUPLICATE_DESCRIPTION_CHOICES:
            raise serializers.ValidationError({'description_match': 'Ungültiger Wert für description_match.'})
        if wodis_match not in self.DUPLICATE_WODIS_CHOICES:
            raise serializers.ValidationError({'wodis_match': 'Ungültiger Wert für wodis_match.'})

        tolerance = None
        if tolerance_raw not in (None, ''):
            try:
                tolerance = int(tolerance_raw)
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    {'purchase_date_tolerance_days': 'Bitte gib eine ganze Zahl an.'}
                ) from exc

            if tolerance < 0 or tolerance > 365:
                raise serializers.ValidationError(
                    {'purchase_date_tolerance_days': 'Wert muss zwischen 0 und 365 liegen.'}
                )

        limit = self.duplicate_default_limit
        if limit_raw not in (None, ''):
            try:
                parsed_limit = int(limit_raw)
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError({'limit': 'Limit muss eine ganze Zahl sein.'}) from exc
            limit = max(25, min(parsed_limit, 500))

        require_any_text_match = False
        if any_text_raw not in (None, ''):
            require_any_text_match = str(any_text_raw).strip().lower() in {'1', 'true', 'yes', 'on'}

        return {
            'name_match': cast(Literal['none', 'exact', 'prefix', 'contains'], name_match),
            'description_match': cast(Literal['none', 'exact', 'contains'], description_match),
            'wodis_match': cast(Literal['none', 'exact'], wodis_match),
            'purchase_tolerance': tolerance,
            'active_criteria': any([
                name_match != 'none',
                description_match != 'none',
                wodis_match != 'none',
                tolerance is not None,
            ]),
            'limit': limit,
            'preset_used': None,
            'require_any_text_match': require_any_text_match,
        }

    @staticmethod
    def _normalise_text(value: str | None) -> str:
        if not value:
            return ''
        return ' '.join(value.strip().lower().split())

    def _match_text(self, left: str | None, right: str | None, mode: Literal['exact', 'prefix', 'contains']) -> bool:
        normal_left = self._normalise_text(left)
        normal_right = self._normalise_text(right)
        if not normal_left or not normal_right:
            return False

        if mode == 'exact':
            return normal_left == normal_right

        if mode == 'prefix':
            prefix_len = 5 if len(normal_left) >= 5 and len(normal_right) >= 5 else 3
            prefix_len = max(3, prefix_len)
            return normal_left[:prefix_len] == normal_right[:prefix_len]

        if mode == 'contains':
            shorter, longer = sorted([normal_left, normal_right], key=len)
            if len(shorter) < 4:
                return False
            return shorter in longer

        return False

    def _match_purchase_date(self, item_one: Item, item_two: Item, tolerance: int) -> bool:
        if not item_one.purchase_date or not item_two.purchase_date:
            return False
        delta = abs((item_one.purchase_date - item_two.purchase_date).days)
        return delta <= tolerance

    def _items_match(self, item_one: Item, item_two: Item, options) -> set[str]:
        reasons: set[str] = set()

        name_mode = options['name_match']
        desc_mode = options['description_match']
        require_any_text_match = options.get('require_any_text_match', False)
        text_field_checked = 0
        text_match_found = False

        if name_mode != 'none':
            text_field_checked += 1
            if self._match_text(item_one.name, item_two.name, name_mode):
                reasons.add(self._label_for_field('name', name_mode))
                text_match_found = True
            elif not require_any_text_match:
                return set()

        if desc_mode != 'none':
            text_field_checked += 1
            if self._match_text(item_one.description, item_two.description, desc_mode):
                reasons.add(self._label_for_field('description', desc_mode))
                text_match_found = True
            elif not require_any_text_match:
                return set()

        if require_any_text_match and text_field_checked > 0 and not text_match_found:
            return set()

        wodis_mode = options['wodis_match']
        if wodis_mode != 'none':
            left = self._normalise_text(item_one.wodis_inventory_number)
            right = self._normalise_text(item_two.wodis_inventory_number)
            if not left or not right:
                return set()
            if left != right:
                return set()
            reasons.add(self._label_for_field('wodis', 'exact'))

        tolerance = options['purchase_tolerance']
        if tolerance is not None:
            if not self._match_purchase_date(item_one, item_two, tolerance):
                return set()
            tolerance_label = f'Kaufdatum (±{tolerance} Tage)'
            reasons.add(tolerance_label)

        return reasons

    @staticmethod
    def _label_for_field(field: str, mode: str) -> str:
        labels = {
            'name': {
                'exact': 'Name (genau)',
                'prefix': 'Name (Anfang passt)',
                'contains': 'Name (enthält)',
            },
            'description': {
                'exact': 'Beschreibung (genau)',
                'contains': 'Beschreibung (enthält)',
            },
            'wodis': {
                'exact': 'WODIS-Nummer',
            },
        }
        return labels.get(field, {}).get(mode, field)

    def _load_quarantine_pairs(self, user):
        if not user or not user.is_authenticated:
            return set()
        entries = DuplicateQuarantine.objects.filter(owner=user, is_active=True).values_list('item_a_id', 'item_b_id')
        return {(min(a, b), max(a, b)) for a, b in entries}

    @staticmethod
    def _is_quarantined_pair(item_one_id, item_two_id, quarantine_pairs):
        key = (min(item_one_id, item_two_id), max(item_one_id, item_two_id))
        return key in quarantine_pairs

    def _build_duplicate_groups(self, items, options, quarantine_pairs):
        total = len(items)
        adjacency: list[list[tuple[int, set[str]]]] = [[] for _ in range(total)]

        for idx, compare_index in self._candidate_pairs(items, options):
            base = items[idx]
            candidate = items[compare_index]
            reasons = self._items_match(base, candidate, options)
            if reasons:
                if self._is_quarantined_pair(base.id, candidate.id, quarantine_pairs):
                    continue
                adjacency[idx].append((compare_index, reasons))
                adjacency[compare_index].append((idx, reasons))

        visited: set[int] = set()
        groups: list[dict[str, list]] = []

        for idx in range(total):
            if idx in visited or not adjacency[idx]:
                continue

            stack = [idx]
            component_indices = []
            reason_accumulator: set[str] = set()

            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                component_indices.append(current)

                for neighbor, edge_reasons in adjacency[current]:
                    reason_accumulator.update(edge_reasons)
                    if neighbor not in visited:
                        stack.append(neighbor)

            if len(component_indices) < 2:
                continue

            sorted_indices = sorted(component_indices, key=lambda i: (self._normalise_text(items[i].name), items[i].id))
            groups.append(
                {
                    'items': [items[i] for i in sorted_indices],
                    'reasons': sorted(reason_accumulator),
                }
            )

        groups.sort(key=lambda entry: len(entry['items']), reverse=True)
        return groups

    def _candidate_pairs(self, items, options):
        """Generate a lossless candidate set using mandatory-match buckets."""

        if options['wodis_match'] == 'exact':
            yield from self._pairs_by_key(
                items,
                lambda item: self._normalise_text(item.wodis_inventory_number),
            )
            return

        tolerance = options['purchase_tolerance']
        if tolerance is not None:
            dated = sorted(
                (item.purchase_date, index)
                for index, item in enumerate(items)
                if item.purchase_date is not None
            )
            window_start = 0
            for current in range(len(dated)):
                while (dated[current][0] - dated[window_start][0]).days > tolerance:
                    window_start += 1
                for previous in range(window_start, current):
                    yield tuple(sorted((dated[previous][1], dated[current][1])))
            return

        if not options.get('require_any_text_match', False):
            if options['name_match'] == 'exact':
                yield from self._pairs_by_key(items, lambda item: self._normalise_text(item.name))
                return
            if options['name_match'] == 'prefix':
                yield from self._pairs_by_key(
                    items,
                    lambda item: self._normalise_text(item.name)[:3],
                )
                return
            if options['description_match'] == 'exact':
                yield from self._pairs_by_key(
                    items,
                    lambda item: self._normalise_text(item.description),
                )
                return

        yield from combinations(range(len(items)), 2)

    @staticmethod
    def _pairs_by_key(items, key_function):
        buckets = defaultdict(list)
        for index, item in enumerate(items):
            key = key_function(item)
            if key:
                buckets[key].append(index)
        for indices in buckets.values():
            yield from combinations(indices, 2)
