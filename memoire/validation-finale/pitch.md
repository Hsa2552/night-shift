# Unspoil — fiche de démonstration

## À ouvrir en premier

Sur ce poste, ouvrir le dossier local dev-dist/pitch-final. Garder un onglet Edge de secours sur le build statique avant de passer devant le jury. Le SHA figé ca93897 a été exercé sur le serveur local, puis après rechargement hors ligne. Le secours e132238 reste aussi disponible en lançant le script avec -Sha e132238.

| Usage | PDF dans le dossier local | Pages et gestes |
| --- | --- | --- |
| Principal, annale réelle | 01-Lyon2-statistiques-L2.pdf | Page 3, « Exercice 3, question 1 » puis « Exercice 3, question 2 ». Les boutons sont au pied de la page. Montrer le retour aux questions intactes après remasquage. |
| Secours 1, QCM réel | 05-Illinois-PHYS214-QCM.pdf | Page 1 pour les questions 1 et 2, puis page 10 pour les boutons des réponses 1 et 2. |
| Secours 2, QCM synthétique | 02-QCM-chimie-synthetique.pdf | Page 1, questions 1 et 2. Trois cases neutralisées par question, texte des six propositions visible. |
| Secours supplémentaire, QCM synthétique | 03-QCM-culture-generale-synthetique.pdf | Page 1, questions 1 et 2. La ligne de réponse est masquée séparément, les six propositions restent lisibles. |
| Révélation progressive, PDF réel | 04-Wisconsin-revelation-progressive.pdf | Lancer le masquage, puis déplacer la frontière vers le bas sur la première page. En clavier, Tab jusque sur la frontière, puis Page suivante. |

## Trois minutes

1. **0:00–0:25**. « On révise souvent avec l'annale et son corrigé dans le même PDF. Les réponses sont déjà sous les yeux avant qu'on ait le temps d'essayer. »
2. **0:25–1:30**. Importer Lyon 2, cliquer « Masquer les corrigés » puis ouvrir « Navigation par page » et aller à la page 3. Montrer les questions bleues et les formules d'énoncé. Aller au pied de page. Révéler la question 1, puis la question 2, remasquer la première et finir avec « Masquer les corrigés » dans la barre. Le changement de page et le défilement jusqu'aux commandes sont l'étape qui prend le plus de temps au micro.
3. **1:30–2:15**. Expliquer la combinaison des indices ci-dessous. Si le jury veut un QCM, montrer le court exemple synthétique. Si le jury demande les cas incertains, montrer la frontière du mode progressif.
4. **2:15–3:00**. Donner un chiffre de démonstration et un chiffre sur un autre corpus. Sur Lyon 2, 17 blocs attendus sur 17 sont indépendamment révélables. Sur le développement complémentaire, un document sur sept réussit le critère historique sur les extraits du candidat figé ca93897. Laisser la FAQ prête pour les questions.

## Sources et portée

La recette Edge a répété Lyon 2 trois fois, dont une après rechargement hors ligne. Le clic d’analyse a pris environ 1,9 à 2,6 s. Les essais incluent deux révélations indépendantes, le remasquage individuel puis global, le zoom, le redimensionnement et le défilement. Sur Illinois, la navigation vers la grille de fin reste l’étape à répéter.

- **Lyon 2**, R. Abdesselam, contrôle continu de statistique et probabilités L2, 2024–2025, quatre pages. Le document contient des questions bleues et des réponses rédigées ou calculées. Edge sur ca93897 couvre 70/70 zones à 95 %, 70/70 au sens strict et 17/17 blocs indépendants. Au seuil historique, 0/38 zones d'énoncé touchées. Le contrôle strict relève deux recouvrements géométriques sans encre d’énoncé masquée. Les 70 zones contenant de l’encre de correction sont sans encre visible. Le résultat concerne cette annale de développement. [PDF d'origine](https://perso.univ-lyon2.fr/~rabdesse/Documents/UFR-SEG/LICENCE/L2/CCC1-2024-2025.pdf)
- **Illinois**, PHYS214, dix pages. Edge sur ca93897 couvre les 30 réponses de la dernière page à 95 % et 29/30 rectangles au sens strict. Les 30 portent une encre évaluée et aucune n'en laisse visible. Les 37 fragments d'énoncé des questions 1 à 3 sont préservés sur la page 1. Les 30 réponses sont indépendantes, avec commandes en page 10. [PDF d'origine](https://courses.physics.illinois.edu/phys214/fa2013/practice/practice_questions.pdf)
- **QCM synthétiques**, fichiers de test du dépôt. Les deux questions de chaque fichier ont passé la séquence de révélation, zoom, défilement et remasquage dans Edge. Le QCM de chimie est le secours le plus rapide si la navigation vers la page 10 prend trop de temps. [Chimie](https://github.com/Hsa2552/night-shift/blob/ca93897/src/detection/samples/qcm-cases.pdf) · [Culture générale](https://github.com/Hsa2552/night-shift/blob/ca93897/src/detection/samples/qcm.pdf)
- **Wisconsin**, CS/ECE252 examen corrigé, neuf pages. L’automatique choisit la révélation progressive. La frontière a progressé dans Edge, avant et après rechargement hors ligne. Utiliser la page 1 pour montrer le geste. [PDF d’origine](https://pages.cs.wisc.edu/~sohi/cs252/Fall2014/handouts/exams/Fall2014_Exam1A_sol.pdf)

La page 2 de Lyon 2 permet de montrer un schéma d’énoncé conservé avec des réponses rédigées masquées. Le diagnostic Washington mêle QCM, surlignage et tableau. Des fonds verts et des réponses y restent lisibles. Le QCM synthétique à options colorées masque toutes les propositions. Le corrigé d'UMass laisse des réponses visibles. Ces documents sont à écarter d'une démonstration de masquage automatique abouti.

## Angle technique

- Le lecteur garde la page d'origine et pose les volets dans le repère des pages PDF. Le zoom change le rendu et la taille des volets ensemble.
- La couche texte fournit les mots et les titres. Les glyphes, tracés et couleurs natives indiquent comment le document a été dessiné. Les pixels complètent ces informations, par exemple pour confirmer qu'un signe est visible.
- Le moteur rapproche ces indices pour retrouver questions et corrections même lorsque la couleur change de sens d'un document à l'autre. L'interface regroupe les masques d'un même corrigé sous une commande.
- Le navigateur exécute React, PDF.js et le détecteur. Les documents restent sur la machine. Le service worker précache l'application et ses ressources pour les prochains imports hors ligne.
- Chaque mesure est liée à un SHA et à des empreintes des fichiers. Nous mesurons le masque réellement présenté, comparons des ablations de signaux et retraçons les régressions avec des tests. Les faibles résultats hors du développement historique sont une limite à annoncer.

## Secours sur le poste de démo

1. **Réseau ou Pages indisponible**. Dans ce dossier, lancer depuis PowerShell la commande .\demarrer-secours.ps1. Ouvrir http://127.0.0.1:4179/night-shift/ dans Edge. Laisser le terminal ouvert. Ctrl+C arrête le serveur. Si le port est occupé, utiliser -Port 4180 et adapter l'adresse.
2. **Ancienne version en cache**. Vérifier le SHA dans la balise HTML unspoil-build. Sur Pages, un profil Edge neuf force une première visite à jour quand le réseau est disponible. En attente de mise à jour, utiliser le build de secours sur son origine locale, puis passer hors ligne après l'avoir chargé.
3. **PDF introuvable**. Les candidats sont dans le sous-dossier pdf. L'exemple d'accueil du produit reste disponible comme ultime secours synthétique.
4. **Analyse qui dépasse dix secondes, commandes absentes ou navigateur incompatible**. Passer au build Edge vérifié et au QCM synthétique de chimie. Si les masques sont douteux, choisir « Révélation progressive » et montrer le geste. Les captures du sous-dossier preuves servent à raconter le parcours si l'application ne peut pas être relancée.
5. **Juste avant le direct**. Préouvrir l'onglet local et répéter une fois les deux clics de révélation sur la page 3. Un téléphone physique et une installation système restent à vérifier.
