#!/usr/bin/env python3
"""
Quick encoding test - check if API sends proper UTF-8
"""

import requests
import json

# Test API endpoint
url = "https://emma.kowobau.eu/api/items/"  # or your actual URL

try:
    response = requests.get(url)
    
    print("=== HTTP Response Analysis ===")
    print(f"Status: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type', 'NOT SET')}")
    print(f"Content-Encoding: {response.headers.get('Content-Encoding', 'NOT SET')}")
    
    # Check raw bytes vs decoded
    print("\n=== Raw Response (first 200 chars) ===")
    print(repr(response.content[:200]))
    
    print("\n=== Decoded Response (first 200 chars) ===") 
    print(response.text[:200])
    
    # Try to parse as JSON
    if response.headers.get('Content-Type', '').startswith('application/json'):
        try:
            data = response.json()
            print("\n=== JSON Parse Success ===")
            if isinstance(data, dict) and 'results' in data:
                for item in data['results'][:2]:  # First 2 items
                    print(f"Item name: {repr(item.get('name', 'NO NAME'))}")
            else:
                print("No 'results' in response")
        except json.JSONDecodeError as e:
            print(f"\n=== JSON Parse Error ===\n{e}")
    
except Exception as e:
    print(f"Request failed: {e}")
