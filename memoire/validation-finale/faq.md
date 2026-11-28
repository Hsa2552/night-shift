# FAQ jury

**Pourquoi ne pas utiliser directement ChatGPT ?** Le geste ici consiste à lire l'annale originale et à occulter des régions précises. Unspoil garde les positions et les formules du PDF, révèle une correction à la demande et fonctionne hors ligne sans envoyer le document.

**Comment détectez-vous les corrections ?** PDF.js rend chaque page et expose le texte et les opérations de dessin. Le moteur croise les conventions de rédaction avec la géométrie, la couleur, les glyphes, les tracés et les pixels. Il produit des zones à masquer et les associe aux questions.

**Comment gérez-vous plusieurs établissements ?** Nous étudions différentes familles de mise en page et vérifions la même procédure sur des annales de plusieurs sources. Une couleur peut signaler la réponse dans un PDF et l'énoncé dans un autre. Le contexte et les autres signaux servent à résoudre cette ambiguïté.

**Que se passe-t-il si le moteur se trompe ?** Il peut masquer un énoncé ou laisser un indice, y compris avec un résultat automatique. L'étudiant peut choisir « Révélation progressive », partir d'une page couverte et décider jusqu'où lire.

**Fonctionne-t-il sur des scans ?** Le rendu et la révélation progressive fonctionnent lorsque la page se rend. Des signaux visuels peuvent aider sur certains scans. Sur un manuscrit ou un document sans couche texte, le masquage automatique dépend du contraste et de la structure. Le produit ne fournit pas d'OCR.

**Fonctionne-t-il sans Internet ?** Oui, après chargement et mise en cache de l'application. Dans Edge, nous avons rechargé, réimporté et analysé un PDF local avec le réseau coupé. Le fichier reste à sélectionner sur l'appareil.

**Les PDF sont-ils envoyés à un serveur ?** L'import lit un fichier local. PDF.js, la détection et le rendu s'exécutent dans le navigateur. Les requêtes observées pendant la recette portent sur les ressources de l'application.

**Comment avez-vous évalué la précision ?** Nous avons annoté les régions d'énoncé et de correction sur les originaux, puis comparé les masques aux annotations. Nous mesurons séparément la couverture, le masquage des questions, les indices QCM, la révélation indépendante et les abstentions. Les tests Edge vérifient l'affichage réel.

**Comment évitez-vous le surajustement ?** Nous séparons développement, validation et test final. Les développeurs reçoivent le développement. Les fichiers réservés restent chez l'évaluateur et le test final ne passe que sur un SHA gelé. Les résultats du lot de développement ne mesurent pas la généralisation.

**Quel avantage par rapport au cache manuel ?** Quand le moteur reconnaît les corrections, l'étudiant peut ouvrir un bloc, remasquer tout le document et continuer dans le même PDF. Le mode progressif garde un contrôle manuel lorsque le découpage automatique est insuffisant.

**Quelle est la complexité technique principale ?** Le dessin du PDF décrit où placer les glyphes, les traits et les images. Il ne décrit généralement pas leur rôle pédagogique. Il faut reconstruire ce rôle sans confondre une donnée nécessaire et une réponse.

**Que feriez-vous avec davantage de temps ?** Nous augmenterions les familles documentaires annotées, ferions relire les labels par un second annotateur et travaillerions sur les fonds colorés et les tableaux. La recette sur des appareils physiques complète les essais navigateur.

**Le produit peut-il être diffusé à grande échelle ?** Il se distribue comme site statique et chaque appareil traite ses imports. Le temps et la mémoire dépendent de l'appareil et du document. Nous avons mesuré des cas ciblés, sans étude de déploiement à grande échelle.

**Comment protégez-vous la confidentialité ?** Le fichier est ouvert en local et le code s'exécute dans le navigateur. Le service worker met en cache les ressources de l'application. Le corpus réservé de l'évaluation demeure sur le poste de l'évaluateur.
