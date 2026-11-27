# Produit

> **Sujet : [DÉCIDÉ] Unspoil (équipe, 27 novembre 2026).**

## Problème

Les étudiants qui s'entraînent sur des annales PDF découvrent parfois les réponses avant d'avoir résolu les exercices. Questions et corrections peuvent se trouver sur la même page ou dans des sections distinctes.

## Utilisateurs cibles

Étudiants qui révisent à partir d'annales et de feuilles d'exercices au format PDF.

## Proposition de valeur

Unspoil masque les corrigés dans le PDF original et permet de les révéler au moment choisi. La PWA traite les fichiers sur l'appareil et conserve la mise en page.

## Parcours principal

1. Importer un PDF local et déclencher « Masquer les corrigés ».
2. Dans un PDF mixte reconnu, consulter les questions et révéler ou remasquer chaque corrigé indépendamment. Dans un corrigé seul reconnu, révéler chaque bloc numéroté.
3. Si le logiciel reconnaît un sujet seul, afficher « Aucun corrigé n'a été détecté ».
4. En cas de structure inconnue ou sur demande, accéder à la révélation progressive. Le PDF démarre couvert et le déplacement vertical d'un trait révèle uniquement le contenu situé au-dessus.

## Périmètre

| ID | Fonctionnalité | Priorité | Tâche |
|---|---|---|---|
| F1 | Import, extraction, rendu du PDF et ressources PWA locales | P0 | T-S-1 |
| F2 | Détection déterministe, classification et segmentation des corrections | P0 | T-HZ-1 |
| F3 | Masques blancs opaques, révélation indépendante et révélation progressive multipage | P0 | T-WB-1 |
| F4 | Couverture de conventions documentaires supplémentaires | P1 | T-HZ-1 |

Hors périmètre : quiz, notation, comptes, bibliothèque d'annales, comparaison de PDF, reconstruction HTML du document, backend et API d'IA.

## Vérification de la démo

Exercer les quatre configurations du parcours avec des PDF autorisés, vérifier le positionnement des masques sur ordinateur et téléphone et tester l'import hors ligne après mise en cache.
