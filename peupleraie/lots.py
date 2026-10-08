"""Lots d'habitation du bâtiment A (Allée de l'Oseraie), relevés sur les plans annexés
au règlement de copropriété de 1989 (rez-de-chaussée et quatre galeries).
lot -> (niveau, escalier, duplex, type) ; duplex : M = montant, D = descendant, "" = simplex."""

from collections.abc import Iterable

Lot = tuple[str, str, str, str]  # (niveau, escalier, duplex, type)

NIVEAUX = ["RdC", "Galerie rouge", "Galerie jaune", "Galerie bleue", "Galerie verte"]

_RDC = {  # escalier A : halls 2 à 10 (côté sud) ; escalier B : halls 10 à 18 (côté nord)
    139: ("A", "D", "F3"),
    140: ("A", "M", "F4"),
    141: ("A", "M", "F5"),
    142: ("A", "D", "F3"),
    143: ("A", "M", "F3"),
    144: ("A", "M", "F4"),
    145: ("A", "D", "F3"),
    147: ("A", "D", "F3"),
    148: ("A", "M", "F4"),
    149: ("A", "M", "F3"),
    152: ("A", "M", "F4"),
    153: ("A", "D", "F3"),
    182: ("A", "M", "F2"),
    150: ("B", "D", "F3"),
    151: ("B", "M", "F4"),
    154: ("B", "M", "F3"),
    155: ("B", "M", "F4"),
    156: ("B", "D", "F3"),
    158: ("B", "D", "F3"),
    159: ("B", "M", "F4"),
    160: ("B", "M", "F3"),
    161: ("B", "D", "F3"),
    162: ("B", "M", "F4"),
    163: ("B", "M", "F4"),
    164: ("B", "D", "F3"),
    183: ("B", "", "F2"),
}

# Les quatre galeries ont la même distribution ; seuls les numéros changent.
# Ordre nord -> sud. Escalier A (porte 6) puis escalier B (porte 14).
_GAL = {
    "Galerie rouge": (
        [
            (204, "D", "F4"),
            (203, "M", "F4"),
            (200, "M", "F4"),
            (199, "D", "F4"),
            (198, "D", "F3"),
            (197, "M", "F3"),
            (226, "M", "F2"),
            (196, "M", "F3"),
            (195, "D", "F3"),
            (194, "D", "F4"),
            (193, "M", "F4"),
            (190, "M", "F4"),
            (189, "D", "F4"),
            (188, "D", "F5"),
            (187, "M", "F5"),
        ],
        [
            (222, "M", "F4"),
            (221, "D", "F4"),
            (220, "D", "F4"),
            (219, "M", "F4"),
            (216, "M", "F4"),
            (215, "D", "F4"),
            (214, "D", "F3"),
            (213, "M", "F3"),
            (227, "M", "F2"),
            (212, "M", "F3"),
            (211, "D", "F3"),
            (210, "D", "F4"),
            (209, "M", "F4"),
            (206, "M", "F4"),
            (205, "D", "F4"),
        ],
    ),
    "Galerie jaune": (
        [
            (248, "D", "F4"),
            (247, "M", "F4"),
            (244, "M", "F4"),
            (243, "D", "F4"),
            (242, "D", "F3"),
            (241, "M", "F3"),
            (270, "M", "F2"),
            (240, "M", "F3"),
            (239, "D", "F3"),
            (238, "D", "F4"),
            (237, "M", "F4"),
            (234, "M", "F4"),
            (233, "D", "F4"),
            (232, "D", "F5"),
            (231, "M", "F5"),
        ],
        [
            (266, "M", "F4"),
            (265, "D", "F4"),
            (264, "D", "F4"),
            (263, "M", "F4"),
            (260, "M", "F4"),
            (259, "D", "F4"),
            (258, "D", "F3"),
            (257, "M", "F3"),
            (271, "M", "F2"),
            (256, "M", "F3"),
            (255, "D", "F3"),
            (254, "D", "F4"),
            (253, "M", "F4"),
            (250, "M", "F4"),
            (249, "D", "F4"),
        ],
    ),
    "Galerie bleue": (
        [
            (292, "D", "F4"),
            (291, "M", "F4"),
            (288, "M", "F4"),
            (287, "D", "F4"),
            (286, "D", "F3"),
            (285, "M", "F3"),
            (314, "M", "F2"),
            (284, "M", "F3"),
            (283, "D", "F3"),
            (282, "D", "F4"),
            (281, "M", "F4"),
            (278, "M", "F4"),
            (277, "D", "F4"),
            (276, "D", "F5"),
            (275, "M", "F5"),
        ],
        [
            (310, "M", "F4"),
            (309, "D", "F4"),
            (308, "D", "F4"),
            (307, "M", "F4"),
            (304, "M", "F4"),
            (303, "D", "F4"),
            (302, "D", "F3"),
            (301, "M", "F3"),
            (315, "M", "F2"),
            (300, "M", "F3"),
            (299, "D", "F3"),
            (298, "D", "F4"),
            (297, "M", "F4"),
            (294, "M", "F4"),
            (293, "D", "F4"),
        ],
    ),
    "Galerie verte": (
        [
            (336, "D", "F4"),
            (335, "M", "F4"),
            (332, "M", "F4"),
            (331, "D", "F4"),
            (330, "D", "F3"),
            (329, "M", "F3"),
            (358, "M", "F1"),
            (328, "M", "F3"),
            (327, "D", "F3"),
            (326, "D", "F4"),
            (325, "M", "F4"),
            (322, "M", "F4"),
            (321, "D", "F4"),
            (320, "D", "F5"),
            (319, "M", "F5"),
        ],
        [
            (354, "M", "F4"),
            (353, "D", "F4"),
            (352, "D", "F4"),
            (351, "M", "F4"),
            (348, "M", "F4"),
            (347, "D", "F4"),
            (346, "D", "F3"),
            (345, "M", "F3"),
            (359, "M", "F1"),
            (344, "M", "F3"),
            (343, "D", "F3"),
            (342, "D", "F4"),
            (341, "M", "F4"),
            (338, "M", "F4"),
            (337, "D", "F4"),
        ],
    ),
}

LOTS_A: dict[int, Lot] = {lot: ("RdC", esc, md, typ) for lot, (esc, md, typ) in _RDC.items()}
for niv, (esc_a, esc_b) in _GAL.items():
    for esc, rows in (("A", esc_a), ("B", esc_b)):
        for lot, md, typ in rows:
            LOTS_A[lot] = (niv, esc, md, typ)


# Bâtiments construits sur le même plan que le A, avec le décalage de leurs numéros de lots.
# C (Allée Georges-Braque) : même plan selon l'utilisatrice ; décalage 501 vérifié sur les 15 ventes DVF
# (type, surface, pièces et escalier concordent pour toutes).
MEME_PLAN: dict[str, int] = {"A": 0, "C": 501}


def lookup(lots: Iterable[object], bat: str = "A") -> Lot | None:
    """Premier lot d'habitation connu parmi les numéros de lots d'une vente, pour un bâtiment au plan du A."""
    if bat not in MEME_PLAN:
        return None
    for numero in lots:
        try:
            k = int(float(numero)) - MEME_PLAN[bat]  # type: ignore[arg-type]
        except (TypeError, ValueError):
            continue
        if k in LOTS_A:
            return LOTS_A[k]
    return None
