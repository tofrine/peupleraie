from peupleraie.lots import LOTS_A, lookup


def test_lot_connu_du_a():
    assert lookup([139]) == LOTS_A[139] == ("RdC", "A", "D", "F3")


def test_bat_c_decalage_501():
    assert lookup([139 + 501], "C") == LOTS_A[139]


def test_bat_sans_plan_connu():
    assert lookup([139], "B") is None


def test_numeros_invalides_ignores():
    assert lookup([None, "x", float("nan"), 140]) == LOTS_A[140]
