#!/usr/bin/env python3
"""
Measure tap jitter risk for FlowAgent node bounds.

This is a diagnostic-only tool. It does not talk to ADB, install APKs, or touch
devices. It can analyze exported FlowAgent dump JSON, uiautomator XML, or a
small built-in sample when no device dump is available.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import statistics
import xml.etree.ElementTree as ET
from pathlib import Path


DEFAULT_JITTER_RATIO = 0.10
DEFAULT_ITERATIONS = 1000

SAMPLE_BOUNDS = [
    {"source": "sample-icon-24", "bounds": "0,0,24,24"},
    {"source": "sample-icon-32", "bounds": "0,0,32,32"},
    {"source": "sample-button-48x32", "bounds": "0,0,48,32"},
    {"source": "sample-row-120x48", "bounds": "0,0,120,48"},
    {"source": "sample-card-180x90", "bounds": "0,0,180,90"},
]


def parse_bounds(value: str) -> dict | None:
    text = str(value or "").strip()
    if not text:
        return None

    # FlowAgent dump format: "left,top,right,bottom".
    comma = re.fullmatch(r"\s*(-?\d+),(-?\d+),(-?\d+),(-?\d+)\s*", text)
    if comma:
        left, top, right, bottom = [int(part) for part in comma.groups()]
    else:
        # uiautomator format: "[left,top][right,bottom]".
        ui = re.fullmatch(r"\s*\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]\s*", text)
        if not ui:
            return None
        left, top, right, bottom = [int(part) for part in ui.groups()]

    width = max(0, right - left)
    height = max(0, bottom - top)
    if width <= 0 or height <= 0:
        return None
    return {
        "left": left,
        "top": top,
        "right": right,
        "bottom": bottom,
        "centerX": (left + right) // 2,
        "centerY": (top + bottom) // 2,
        "width": width,
        "height": height,
    }


def load_json_nodes(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("nodes", "items", "dump"):
            value = data.get(key)
            if isinstance(value, list):
                return value
    return []


def load_xml_nodes(path: Path) -> list[dict]:
    root = ET.parse(path).getroot()
    nodes: list[dict] = []
    for index, elem in enumerate(root.iter()):
        bounds = elem.attrib.get("bounds")
        if not bounds:
            continue
        label = elem.attrib.get("text") or elem.attrib.get("content-desc") or elem.attrib.get("resource-id") or ""
        nodes.append({"source": f"xml:{index}", "bounds": bounds, "label": label})
    return nodes


def load_nodes(path: Path | None) -> list[dict]:
    if path is None:
        return SAMPLE_BOUNDS
    suffix = path.suffix.lower()
    if suffix == ".json":
        return load_json_nodes(path)
    if suffix == ".xml":
        return load_xml_nodes(path)
    raise SystemExit(f"Unsupported input format: {path}")


def current_axis_range(bounds: dict, axis: str, jitter_ratio: float) -> tuple[int, int]:
    if axis == "x":
        size = bounds["width"]
        center = bounds["centerX"]
    else:
        size = bounds["height"]
        center = bounds["centerY"]
    safe_size = max(1, int(size * (1.0 - jitter_ratio)))
    return center - safe_size // 2, center + safe_size // 2


def adaptive_axis_range(start: int, end: int, size: int, jitter_ratio: float) -> tuple[int, int]:
    if size <= 3:
        return start, max(start, end - 1)
    min_margin = 2 if size < 28 else 3 if size < 48 else 4
    proportional_margin = int(round(size * jitter_ratio))
    margin = min(max(min_margin, proportional_margin), max(0, (size - 1) // 2))
    low = start + margin
    high = end - 1 - margin
    if low > high:
        center = (start + end) // 2
        return center, center
    return low, high


def simulated_points(bounds: dict, jitter_ratio: float, iterations: int, rng: random.Random, mode: str) -> list[tuple[int, int]]:
    width = bounds["width"]
    height = bounds["height"]
    if mode == "current":
        min_x, max_x = current_axis_range(bounds, "x", jitter_ratio)
        min_y, max_y = current_axis_range(bounds, "y", jitter_ratio)
    else:
        min_x, max_x = adaptive_axis_range(bounds["left"], bounds["right"], width, jitter_ratio)
        min_y, max_y = adaptive_axis_range(bounds["top"], bounds["bottom"], height, jitter_ratio)
    return [(rng.randint(min_x, max_x), rng.randint(min_y, max_y)) for _ in range(iterations)]


def classify_margin(min_margin_px: int, min_dimension: int) -> str:
    if min_dimension < 28 or min_margin_px <= 1:
        return "high"
    if min_dimension < 40 or min_margin_px <= 3:
        return "medium"
    return "low"


def measure_node(node: dict, jitter_ratio: float, iterations: int, rng: random.Random, mode: str) -> dict | None:
    bounds = parse_bounds(str(node.get("bounds", "") or ""))
    if not bounds:
        return None

    points = simulated_points(bounds, jitter_ratio, iterations, rng, mode)
    outside = 0
    margins = []
    for x, y in points:
        if x < bounds["left"] or x >= bounds["right"] or y < bounds["top"] or y >= bounds["bottom"]:
            outside += 1
        margins.append(min(x - bounds["left"], bounds["right"] - 1 - x, y - bounds["top"], bounds["bottom"] - 1 - y))

    min_margin = min(margins) if margins else 0
    median_margin = statistics.median(margins) if margins else 0
    min_dimension = min(bounds["width"], bounds["height"])
    return {
        "source": str(node.get("source") or node.get("id") or node.get("resourceId") or node.get("label") or ""),
        "label": str(node.get("label") or node.get("text") or node.get("desc") or ""),
        "bounds": f'{bounds["left"]},{bounds["top"]},{bounds["right"]},{bounds["bottom"]}',
        "width": bounds["width"],
        "height": bounds["height"],
        "iterations": iterations,
        "outsideCount": outside,
        "outsideRate": outside / float(iterations or 1),
        "minMarginPx": int(min_margin),
        "medianMarginPx": float(median_margin),
        "risk": classify_margin(int(min_margin), min_dimension),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure FlowAgent tap jitter risk.")
    parser.add_argument("--input", type=Path, help="FlowAgent JSON dump or uiautomator XML dump.")
    parser.add_argument("--output", type=Path, help="Optional JSON report path.")
    parser.add_argument("--jitter-ratio", type=float, default=DEFAULT_JITTER_RATIO)
    parser.add_argument("--iterations", type=int, default=DEFAULT_ITERATIONS)
    parser.add_argument("--mode", choices=["current", "adaptive"], default="adaptive")
    parser.add_argument("--seed", type=int, default=4310)
    args = parser.parse_args()

    rng = random.Random(args.seed)
    nodes = load_nodes(args.input)
    results = [
        measured
        for node in nodes
        if (measured := measure_node(node, args.jitter_ratio, args.iterations, rng, args.mode)) is not None
    ]
    summary = {
        "input": str(args.input) if args.input else "built-in-sample",
        "mode": args.mode,
        "jitterRatio": args.jitter_ratio,
        "iterationsPerNode": args.iterations,
        "nodesMeasured": len(results),
        "outsideTotal": sum(item["outsideCount"] for item in results),
        "riskCounts": {
            "high": sum(1 for item in results if item["risk"] == "high"),
            "medium": sum(1 for item in results if item["risk"] == "medium"),
            "low": sum(1 for item in results if item["risk"] == "low"),
        },
        "results": results,
    }

    text = json.dumps(summary, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
