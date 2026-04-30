
Pokemon Aube et Crépuscule est une application web angular python fast API qui permet à un utilisateur de créer des équipes de pokémon et d'affronter d'autres utilisateurs dans trois modes de jeux : 
- Draft
- Construit
- Hasard
# Startup et Installation 

## Pré-requis 

Avoir installer minikube, kubectl, docker.

## Lancement 

Afin de lancer le projet, nous avons fait un script shell pour plus de facilité. 
Pour le lancer, a la racine du projet, faire : 
```
cd back
./start.sh
``` 

Ce script prends quelque temps à s'exécuter car il démarre minikube s'il n'est pas démarré, active l'ingress, construit les images docker, enregistre dans /etc/hosts notre dns *pokemon.aube.crepuscule* et déploie sur kubernetes avec :
```
kubectl apply -f k8s/ -n pokemon-aube-crepuscule
```

Pour l'enregistrement du DNS, le script vous demandera le mot de passe sudo.

Une fois le script terminé, il faut attendre quelques minutes que tous les pods démarrent.
Vous pouvez suivre l'avancé avec : 

```
kubectl get pods -n pokemon-aube-crepuscule
```

Il est possible que des services comme la db ou logs prennent du temps à se lancer, ou même apparaissent comme *CrashLoopBackOff* ou *Error*. C'est tout à fait normal et kubernetes va redémarrer automatiquement les pods.
Il est aussi possible que la db soit en Running, mais la connexion aux comptes pré-crées ne marche pas. Il suffit d'attendre quelques secondes de plus.

Lorsque tous les pods seront lancés, vous devriez avoir un affichage comme ci-dessous, et le site sera disponible sur : 

http://pokemon.aube.crepuscule

![[Pasted image 20260430151438.png]]
# Informations et Technique 

- L'API pokémon allant jusqu'a l'id 1025, nos services également.
- Le logo du site Aube et Crépuscule sert de bouton de retour à la page Home. 
 ![[Pasted image 20260430133708.png|]]
 - Cliquer sur le pseudo d'un joueur, dans le chat ou dans un duel ouvre une petite page avec avatar pseudo et aura (points).
 ![[Pasted image 20260430162819.png|300]]


Pour supprimer le projet, fermer les db etc, faites simplement : 
```
minikube delete
```

# Login / Register 

L'utilisateur peut créer et se connecter à son compte via email et mot de passe.
Lors de la création de compte, il est demandé à l'utilisateur de remplir nom, prénom, pseudo, mail, mot de passe et de choisir une équipe. 
L'équipe et le pseudo sont changeables sur la page home.

![[Pasted image 20260430122926.png]]

3 comptes sont créés au premier lancement de l'application afin de réaliser les tests : 

Compte admin -> email : admin@pokemon.com , mdp : admin 
Compte red -> email : red@pokemon.com, mdp : test
Compte blue -> email : blue@pokemon.com, mdp : test


# Page Home 

Sur la page Home, plusieurs actions sont possibles.

![[Pasted image 20260430161126.png]]

## Trainer Card : 

La trainer card correspond à l'identité du joueur : 

![[Pasted image 20260430131122.png]]

Le joueur peut également voir son *Aura*, notre équivalent au élo. Le joueur commence à 500 d'Aura et gagne/perd +/- 10 points à chaque partie.

La première action possible par, seulement pour les admins, est d'ouvrir la console de log avec le bouton **Admin Logs**.
Les services ont des évènements qui vont générer des logs puis les envoient au service de log.
Cela comprend la création et la connexion à un compte, la création d'une équipe, sa modification etc puis le lancement d'un nouveau duel.

![[Pasted image 20260430125708.png]]


Les utilisateurs peuvent également modifier leurs informations en appuyant sur le bouton **Edit**.
Pour changer d'équipe, l'utilisateur a seulement besoin de cliquer sur sa couleur d'équipe et le front changera dynamiquement.
Pour enregistrer les modifications, il faut simplement appuyer sur le bouton **Save**.

![[Pasted image 20260430161202.png|300]]![[Pasted image 20260430130110.png|350]]

En appuyant sur le bouton **Chat visible seulement par mon équipe**, cela filtre les messages envoyés à l'autre équipe.

Les utilisateurs peuvent également regarder leur historique avec le bouton **Historique**. En cliquant sur un match, les détails du match apparaissent.

![[Pasted image 20260430130857.png|500]]

Enfin le joueur peut se déconnecter avec le bouton **Déconnexion**
## Mode de jeu et redirection 

![[Pasted image 20260430161329.png]]

Ici, il est possible de se rediriger vers **Mes Equipes** et **Pokedex**.

Pour les modes de jeux Hasard et Draft, l'utilisateur à seulement besoin d'appuyer sur **Start Game** et il affrontera un autre utilisateur qui cherche un match dans le même mode de jeu.
Pour le monde construit, le joueur devra d'abord choisir une équipe *Complete* avant de pouvoir appuyer sur **Start Game**

![[Pasted image 20260430161356.png|350]]![[Pasted image 20260430132345.png|300]]

La portion **CGU & CONTACT** ouvre une page avec les cgu et les 4 mails de contact.
![[Pasted image 20260430161441.png]]
# Page Mes Equipes

La page Mes Equipes est la page sur laquelle l'utilisateur peut : Créer, Supprimer, Modifier ou Compléter une équipe.

![[Pasted image 20260430132632.png]]

En cliquant sur **Modifier**, l'équipe passe en mode édition et l'utilisateur peut enlever un pokémon en cliquant dessus ou en rajouter un en cliquant dans un espace libre et en rentrant l'ID du pokémon. Pour sauvegarder et quitter le mode édition, il suffit d'appuyer sur **Save**.

![[Pasted image 20260430133127.png]]
![[Pasted image 20260430133253.png]]

Le bouton **Delete** supprime l'équipe et le bouton **Complète** la complete SI elle n'est pas pleine.

# Page Pokedex 

La page Pokedex permet d'afficher tous les Pokémons ainsi que de faire des recherches :

- Nom (Anglais SEULEMENT)
- ID
- Type 1 
- Type 2 

![[Pasted image 20260430134302.png]]

Les fiches de pokémon contiennent toutes les informations importantes sur les pokémons et peuvent être retournés en cliquant dessus pour en afficher d'autres.

![[Pasted image 20260430145550.png]]

Lorsque l'on cherche un Type 1 et un Type 2, il faut que le pokémon possède les DEUX types.

![[Pasted image 20260430145628.png]]

Il est possible de réinitialiser la recherche en appuyant sur le petit soleil dans la barre de recherche.

En appuyant sur **Ajouter à une équipe** l'utilisateur peut rajouter le pokémon a une de ses équipes non-pleines.

![[Pasted image 20260430163104.png]]


# Page duel 

Il y a trois modes de jeux comme précisé plus tôt : hasard,construit et draft.
Chaque tour le joueur peut décider de stay avec le bouton **Stay** ou de changer son pokémon en cliquant sur le pokémon qu'il souhaite envoyer.

Le mode hasard tire a sort 6 pokémons, les pokémons non joués sont cachés pour l'adversaire.
![[Pasted image 20260430161541.png]]

Le mode construit lui oppose les deux équipes que les joueurs ont choisis dans le home.

![[Pasted image 20260430161648.png]]

Enfin le mode draft, 12 pokémons sont tirés aux sorts et chaque joueur choisis des pokémons dans un ordre de draft ( 1-2-2-...)

![[Pasted image 20260430161757.png]]
