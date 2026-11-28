# Corpus complémentaire de développement

Le lot zip-dev comprend sept PDF publics et 259 zones annotées sur dix pages. Codex a choisi et relu les zones sur le rendu original, avec un relevé de coordonnées par PyMuPDF, avant tout passage dans le moteur. Le périmètre de chaque document figure dans son fichier d'annotation. Les résultats portent sur des extraits et une décision d'affichage par PDF complet. Une relecture humaine et une relecture croisée restent à faire.

L'archive d'origine fournissait des références. Le téléchargement a fixé les premières empreintes SHA-256 des octets effectivement reçus. Les noms du manifeste sont normalisés pour le benchmark existant. Le contrôle d'URL et d'empreinte exclut les duplications exactes avec le manifeste historique. L'indépendance typographique reste à vérifier.

Le manifeste publiable contient le développement. Les PDF d'origine s'obtiennent auprès des établissements. Les lots de validation et de test final, leurs métadonnées détaillées, annotations et résultats individuels restent locaux.

## Reproduire dans Edge sous PowerShell

Exécuter depuis le checkout qui contient le manifeste publié. Le chemin du candidat désigne un checkout propre du SHA à mesurer déjà construit avec la base /night-shift/ et l'option --manifest. Les annotations restent dans le checkout qui lance le script.

~~~powershell
$Candidate = 'C:\chemin\vers\le\checkout-construit'
$manifest = (Resolve-Path 'src/detection/eval/zip-dev.tsv').Path
$cache = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.cache/unspoil-zip-dev'
$pdfDir = Join-Path $cache 'zip-dev'
New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null
foreach ($row in (Import-Csv -LiteralPath $manifest -Delimiter ([char]9))) {
    $file = Join-Path $pdfDir ($row.nom + '.pdf')
    if (!(Test-Path -LiteralPath $file)) {
        Invoke-WebRequest -UseBasicParsing -Uri $row.url -OutFile $file
    }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $row.sha256) {
        throw "Empreinte différente pour $($row.nom)"
    }
}
$env:UNSPOIL_BENCH_MANIFEST = $manifest
$env:UNSPOIL_BENCH_INK = '1'
node scripts/benchmark-browser.mjs $Candidate zip-dev $cache (Join-Path $cache 'edge-zip-dev.json')
Remove-Item Env:UNSPOIL_BENCH_MANIFEST, Env:UNSPOIL_BENCH_INK
~~~

Le rapport indique le SHA réellement servi et l'empreinte du corpus. Le protocole utilise le seuil historique de couverture de 95 % et la réussite stricte déjà employés.
