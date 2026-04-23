# Matrice basée sur la page 16 du PDF [cite: 271]
TYPE_MAP = {
    "Normal": {"Roche": 0.5, "Spectre": 0, "Acier": 0.5},
    "Feu": {"Feu": 0.5, "Eau": 0.5, "Plante": 2, "Glace": 2, "Insecte": 2, "Roche": 0.5, "Dragon": 0.5, "Acier": 2},
    "Eau": {"Feu": 2, "Eau": 0.5, "Plante": 0.5, "Sol": 2, "Roche": 2, "Dragon": 0.5},
    "Plante": {"Feu": 0.5, "Eau": 2, "Plante": 0.5, "Poison": 0.5, "Sol": 2, "Vol": 0.5, "Insecte": 0.5, "Roche": 2, "Dragon": 0.5, "Acier": 0.5},
    "Électrik": {"Eau": 2, "Plante": 0.5, "Électrik": 0.5, "Sol": 0, "Vol": 2, "Dragon": 0.5},
    "Glace": {"Feu": 0.5, "Eau": 0.5, "Plante": 2, "Glace": 0.5, "Sol": 2, "Vol": 2, "Dragon": 2, "Acier": 0.5},
    "Combat": {"Normal": 2, "Glace": 2, "Poison": 0.5, "Vol": 0.5, "Psy": 0.5, "Insecte": 0.5, "Roche": 2, "Spectre": 0, "Ténèbres": 2, "Acier": 2, "Fée": 0.5},
    "Poison": {"Plante": 2, "Poison": 0.5, "Sol": 0.5, "Roche": 0.5, "Spectre": 0.5, "Acier": 0, "Fée": 2},
    "Sol": {"Feu": 2, "Plante": 0.5, "Électrik": 2, "Poison": 2, "Vol": 0, "Insecte": 0.5, "Roche": 2, "Acier": 2},
    "Vol": {"Plante": 2, "Électrik": 0.5, "Combat": 2, "Insecte": 2, "Roche": 0.5, "Acier": 0.5},
    "Psy": {"Combat": 2, "Poison": 2, "Psy": 0.5, "Ténèbres": 0, "Acier": 0.5},
    "Insecte": {"Feu": 0.5, "Plante": 2, "Combat": 0.5, "Poison": 0.5, "Vol": 0.5, "Psy": 2, "Spectre": 0.5, "Ténèbres": 2, "Acier": 0.5, "Fée": 0.5},
    "Roche": {"Feu": 2, "Glace": 2, "Combat": 0.5, "Sol": 0.5, "Vol": 2, "Insecte": 2, "Acier": 0.5},
    "Spectre": {"Normal": 0, "Psy": 2, "Spectre": 2, "Ténèbres": 0.5,"Acier": 0.5},
    "Dragon": {"Dragon": 2, "Acier": 0.5, "Fée": 0},
    "Ténèbres": {"Combat": 0.5, "Psy": 2, "Spectre": 2, "Ténèbres": 0.5, "Acier": 0.5, "Fée": 0.5},
    "Acier": {"Feu": 0.5, "Eau": 0.5, "Glace": 2, "Roche": 2, "Acier": 0.5, "Fée": 2},
    "Fée" : {"Feu": 0.5, "Combat": 2, "Poison": 0.5, "Dragon": 2, "Ténèbres": 2, "Acier": 0.5}
}

def get_mult(atk, dfs):
    if not atk or not dfs: return 1.0
    return TYPE_MAP.get(atk, {}).get(dfs, 1.0)

def calculate_advantages(pk_attaque, pk_defense):
    # Formule : F(A) = 1*(W/Y)*(W/Z) + 1*(X/Y)*(X/Z) 
    w, x = pk_attaque['types'][0], (pk_attaque['types'][1] if len(pk_attaque['types']) > 1 else None)
    y, z = pk_defense['types'][0], (pk_defense['types'][1] if len(pk_defense['types']) > 1 else None)

    f_attaque = (1 * get_mult(w, y) * get_mult(w, z)) + (1 * get_mult(x, y) * get_mult(x, z))
    f_defense = (1 * get_mult(y, w) * get_mult(y, x)) + (1 * get_mult(z, w) * get_mult(z, x))
    
    return f_attaque, f_defense