"""
Shared Excel header-matching for every guided-import surface (Students
bulk-import, Results upload, and any future one).

WHY THIS FILE EXISTS: both importers used to hardcode an exact-string
dict (header text -> field). That meant "Rollnumber" (no space) silently
failed to match "roll number" / "roll no" — a real header a real sheet
used, rejected only because it wasn't byte-identical to a string someone
had hardcoded. The fix, per Boss: the code should only hardcode the
*minimum required fields* (like a Kanban board only hardcodes "block,
color, slot" and lets the user label it anything) — everything else
about header wording should be tolerantly interpreted, not exactly
demanded. This module is that tolerance layer, shared so both importers
match headers the same way instead of drifting apart.

Matching is two-tier:
  1. Exact tier — normalized header hits a known alias exactly. Always
     wins if present; this is what disambiguates near-neighbor fields
     (e.g. "Father's Phone" vs "Parent Phone" vs plain "Phone") so fuzzy
     scoring never gets a chance to conflate them.
  2. Fuzzy tier — only for headers that miss the exact tier. Scored
     against every field's canonical name + alias list; best match wins
     if it clears CONFIDENCE_THRESHOLD, else the header is left unmatched.

Every call returns enough detail to build a mapping report — which
headers were recognized (and how: exact vs fuzzy) and which were
ignored. Per Boss: unmatched columns must NEVER be silently dropped from
what the user is told, even though they're safely ignored in the import
itself.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any

# WHY 0.82: high enough that unrelated fields (e.g. "Category" vs
# "Consultant Name") never cross it, low enough to absorb real-world
# noise — missing spaces, a trailing "." or "No" vs "Number" swap, minor
# typos. Tuned against the known alias lists below, not picked blind.
CONFIDENCE_THRESHOLD = 0.82


# WHY A SEPARATE ABBREVIATION PASS (not just a lower fuzzy threshold):
# "No" vs "Number" is an extremely common real-form convention ("Roll No"
# / "Roll Number", "Aadhaar No" / "Aadhaar Number", "Phone No" /
# "Phone Number") — but "no"/"number" as raw strings only score ~0.75-0.8
# on SequenceMatcher, under CONFIDENCE_THRESHOLD. Lowering the global
# threshold to catch this would also start conflating genuinely different
# fields elsewhere (the exact risk the anchor doc warns against). Instead,
# canonicalize this ONE known abbreviation as its own normalization step,
# applied identically to both sheet headers and stored aliases, so "No"
# and "Number" become the same token before either exact or fuzzy
# matching ever runs.
_ABBREVIATION_TOKENS = {
    "no": "number",
    "nos": "number",
}



def roll_prefix_to_batch(roll_no: str) -> str | None:
    """Admission-year cohort label from a roll number's leading 2 digits.

    Returns the bare ``YYYY-YYYY`` cohort key, or ``None`` when the roll
    prefix cannot be interpreted as a plausible admission year.
    """
    roll_no = (roll_no or "").strip().upper()
    if len(roll_no) >= 2 and roll_no[:2].isdigit():
        yy = int(roll_no[:2])
        if 18 <= yy <= 35:
            joining_year = 2000 + yy
            return f"{joining_year}-{joining_year + 4}"
    return None

def normalize_header(raw: Any) -> str:
    """Lowercase, strip punctuation, collapse whitespace, canonicalize
    known abbreviations.

    "Roll No.", "ROLL NO", "Roll  No", "Roll-No", "Roll Number" all
    normalize to the same string so exact-tier matching isn't defeated by
    cosmetic noise or common abbreviation before fuzzy matching is even
    attempted.

    Apostrophes are DROPPED, not turned into a space: "Father's Name"
    and "Fathers Name" must normalize identically ("fathers name"), since
    that's a genuinely common real-world spelling variant, not two
    different headers. Every other punctuation character still becomes a
    space (word-separator behavior).
    """
    text = str(raw or "").lower()
    text = text.replace("'", "").replace("\u2019", "")  # apostrophe + curly variant
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [_ABBREVIATION_TOKENS.get(tok, tok) for tok in text.split()]
    return " ".join(tokens)


@dataclass
class FieldSpec:
    """One importable field: its internal key, its exact aliases (as
    already-normalized strings), and whether the whole import fails
    without it.
    """
    key: str
    aliases: set[str]
    required: bool = False


@dataclass
class HeaderMatch:
    header: str            # original header text from the sheet, verbatim
    field: str | None       # resolved field key, or None if unmatched
    via: str                # "exact" | "fuzzy" | "unmatched"
    score: float = 0.0      # similarity score for fuzzy matches (0 for exact/unmatched)


@dataclass
class MatchReport:
    matches: list[HeaderMatch] = field(default_factory=list)

    @property
    def mapped(self) -> list[HeaderMatch]:
        return [m for m in self.matches if m.field]

    @property
    def ignored(self) -> list[HeaderMatch]:
        return [m for m in self.matches if not m.field]

    def field_index(self) -> dict[str, int]:
        """field key -> column index, for the first header that resolved
        to it (matches earlier importer behavior of "first match wins").
        """
        out: dict[str, int] = {}
        for idx, m in enumerate(self.matches):
            if m.field and m.field not in out:
                out[m.field] = idx
        return out

    def missing_required(self, specs: list[FieldSpec]) -> list[str]:
        resolved = {m.field for m in self.matches if m.field}
        return [s.key for s in specs if s.required and s.key not in resolved]

    def as_dict(self) -> dict:
        """JSON-safe shape for API responses — this is what the frontend
        renders as the mapping report so the user sees exactly what was
        recognized and what was ignored. Never omit this from a response;
        that omission is the exact regression Boss called out.
        """
        return {
            "mapped": [
                {"header": m.header, "field": m.field, "matched_via": m.via}
                for m in self.mapped
            ],
            "ignored": [m.header for m in self.ignored],
        }


def _best_fuzzy(norm_header: str, specs: list[FieldSpec]) -> tuple[str | None, float]:
    best_field, best_score = None, 0.0
    for spec in specs:
        candidates = {spec.key.replace("_", " ")} | spec.aliases
        for cand in candidates:
            score = SequenceMatcher(None, norm_header, cand).ratio()
            if score > best_score:
                best_field, best_score = spec.key, score
    if best_score >= CONFIDENCE_THRESHOLD:
        return best_field, best_score
    return None, best_score


def match_headers(headers: list[Any], specs: list[FieldSpec]) -> MatchReport:
    """Resolve a sheet's header row against a list of known fields.

    Exact tier first (normalized header in a spec's alias set), fuzzy
    tier as fallback for anything that misses. First header to claim a
    field wins subsequent same-field headers are left unmatched rather
    than silently overwriting the first mapping (surfaced as "ignored",
    same as any other unmatched header, so the user can see the sheet
    had a duplicate-looking column instead of it vanishing).
    """
    report = MatchReport()
    claimed_fields: set[str] = set()
    exact_lookup: dict[str, str] = {}
    for spec in specs:
        for alias in spec.aliases:
            exact_lookup[alias] = spec.key

    normalized_headers = [normalize_header(h) for h in headers]
    exact_fields_present: dict[str, int] = {}
    for idx, norm in enumerate(normalized_headers):
        exact_field = exact_lookup.get(norm)
        if exact_field and exact_field not in exact_fields_present:
            exact_fields_present[exact_field] = idx

    for idx, raw_header in enumerate(headers):
        header_text = str(raw_header or "").strip()
        if not header_text:
            continue
        norm = normalized_headers[idx]

        field_key = exact_lookup.get(norm)
        via, score = "exact", 0.0
        if field_key is None:
            field_key, score = _best_fuzzy(norm, specs)
            via = "fuzzy" if field_key else "unmatched"
            # Reliability guard: never let a fuzzy match claim a field that
            # has an exact header elsewhere in the same row. This matters
            # especially for short institution-style headers (e.g. "S NO")
            # that can accidentally score above the global fuzzy threshold
            # against a longer canonical name such as "roll number". The
            # exact header remains the authoritative mapping.
            exact_idx = exact_fields_present.get(field_key) if field_key else None
            if exact_idx is not None and exact_idx != idx:
                field_key, via, score = None, "unmatched", 0.0

        if field_key and field_key in claimed_fields:
            # Field already resolved from an earlier column in this same
            # sheet — don't let a second column silently double-claim it.
            report.matches.append(HeaderMatch(header_text, None, "unmatched", 0.0))
            continue

        if field_key:
            claimed_fields.add(field_key)
        report.matches.append(HeaderMatch(header_text, field_key, via, score))

    return report
