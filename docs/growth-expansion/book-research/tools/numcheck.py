"""Recompute the evaluation cases' numeric checks from their formula text. Standard library only."""
import ast
import math
import operator
import re

FUNCS = {"ceil": math.ceil, "floor": math.floor, "sqrt": math.sqrt, "round": round, "min": min, "max": max,
         "log": math.log, "ln": math.log, "exp": math.exp, "abs": abs, "log10": math.log10}
OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
       ast.Pow: operator.pow, ast.USub: operator.neg, ast.UAdd: operator.pos, ast.Mod: operator.mod, ast.FloorDiv: operator.floordiv}


def _ev(n):
    if isinstance(n, ast.Expression):
        return _ev(n.body)
    if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
        return n.value
    if isinstance(n, ast.BinOp) and type(n.op) in OPS:
        return OPS[type(n.op)](_ev(n.left), _ev(n.right))
    if isinstance(n, ast.UnaryOp) and type(n.op) in OPS:
        return OPS[type(n.op)](_ev(n.operand))
    if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id in FUNCS:
        return FUNCS[n.func.id](*[_ev(a) for a in n.args])
    if isinstance(n, ast.Compare) and len(n.ops) == 1:
        a, b = _ev(n.left), _ev(n.comparators[0])
        cmp = {ast.Lt: a < b, ast.LtE: a <= b, ast.Gt: a > b, ast.GtE: a >= b}.get(type(n.ops[0]))
        if cmp is None:
            raise ValueError("unsupported")
        return 1 if cmp else 0
    if isinstance(n, ast.Tuple):
        return tuple(_ev(e) for e in n.elts)
    raise ValueError("unsupported")


def normalise(s):
    s = re.sub(r"\((?![^()]*\d\s*[+\-*/x×])[^()]*[A-Za-z]{2,}[^()]*\)", " ", s)  # drop prose parentheticals
    s = re.sub(r",?\s*(rounded to|round(ed)?)\s*\d+\s*(dp|decimals?)?|\b\d+\s*dp\b", " ", s)
    s = re.sub(r"\s[xX]\s", " * ", s)
    s = s.replace("×", "*").replace("−", "-").replace("–", "-").replace("÷", "/").replace("^", "**").replace("$", "")
    s = re.sub(r"(?<=\d),(?=\d{3}\b)", "", s)          # 1,000 -> 1000
    s = re.sub(r"(?<=[\d)])\s*[xX]\s*(?=[\d(])", "*", s)  # 3 x 4 -> 3*4
    s = re.sub(r"(\d+(?:\.\d+)?)%", r"(\1/100)", s)    # 5% -> (5/100)
    return s


CAND = re.compile(r"(?:ceil|floor|sqrt|round|min|max|log10|log|ln|exp|abs|[\d.()+\-*/ ,])+")


def candidates(formula):
    s = normalise(formula)
    out = []
    for part in [s] + s.split("=")[::-1] + re.split(r"[;:]", s):
        for m in CAND.finditer(part):
            t = m.group(0).strip(" ,")
            if re.search(r"\d", t) and re.search(r"[+\-*/]|ceil|floor|sqrt|round|min|max|log|exp", t) or re.fullmatch(r"\d+(\.\d+)?", t or "x"):
                out.append(t)
    return sorted(set(out), key=len, reverse=True)


def check(formula, expected, rel=0.01, abs_tol=0.0051):
    """Return (status, value): status ok | mismatch | unparsed."""
    best = None
    for t in candidates(formula):
        try:
            v = _ev(ast.parse(t, mode="eval"))
        except Exception:  # noqa: BLE001
            continue
        if isinstance(v, tuple):
            continue
        if best is None:
            best = v
        if math.isclose(v, expected, rel_tol=rel, abs_tol=abs_tol):
            return "ok", v
    return ("mismatch", best) if best is not None else ("unparsed", None)
