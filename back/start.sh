#!/bin/bash

# Arret si echec
set -e 

echo "======================================================="
echo "Début de l'installation de Pokémon Aube Crépuscule ☀️ ..."
echo "======================================================="

#Pre requis
command -v minikube >/dev/null 2>&1 || { echo >&2 "minikube n'est pas installé. Abandon."; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo >&2 "kubectl n'est pas installé. Abandon."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo >&2 "docker n'est pas installé. Abandon."; exit 1; }

#Start minikube
echo "Vérification de Minikube..."
if ! minikube status | grep -q "Running"; then
    echo "Démarrage de Minikube..."
    minikube start
fi

#Activation ingress
echo "Activation de l'Ingress Nginx..."
minikube addons enable ingress

#Image local
echo "Configuration de l'environnement Docker..."
eval $(minikube -p minikube docker-env)

TOTAL_IMAGES=9
echo "======================================================="
echo "  Construction des $TOTAL_IMAGES images Docker... "
echo "======================================================="

echo " ☀️[1/$TOTAL_IMAGES] Construction de Frontend..."
docker build -t back-frontend:latest ../front

echo " ☀️[2/$TOTAL_IMAGES] Construction de Auth Service..."
docker build -t back-auth_service:latest ./auth_service

echo " ☀️[3/$TOTAL_IMAGES] Construction de Battle Engine..."
docker build -t back-battle_engine:latest ./battle_engine

echo " ☀️[4/$TOTAL_IMAGES] Construction de Chat Service..."
docker build -t back-chat_service:latest ./chat_service

echo " ☀️[5/$TOTAL_IMAGES] Construction de Duel Service..."
docker build -t back-duel-service:latest ./duel_service

echo " ☀️[6/$TOTAL_IMAGES] Construction de Log Service..."
docker build -t back-log_service:latest ./log_service

echo " ☀️[7/$TOTAL_IMAGES] Construction de Pokemon Service..."
docker build -t back-pokemon-service:latest ./pokemon_service

echo " ☀️[8/$TOTAL_IMAGES] Construction de Pokemon Team Service..."
docker build -t back-pokemon-team-service:latest ./pokemon_teams_service

echo " ☀️[9/$TOTAL_IMAGES] Construction de Team Service..."
docker build -t back-teams_service:latest ./teams_service

#Déploiement K8s
echo "======================================================="
echo "  Déploiement de l'infrastructure dans Kubernetes..."
echo "======================================================="
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/ -n pokemon-aube-crepuscule

#Configuration du nom de domaine
IP=$(minikube ip)
DOMAIN="pokemon.aube.crepuscule"

echo "======================================================="
echo "  Configuration du nom de domaine ($DOMAIN)..."
echo "======================================================="
if grep -q "$DOMAIN" /etc/hosts; then
    echo "Le domaine est déjà configuré."
else
    echo "⚠️ Le domaine doit être ajouté à ton fichier /etc/hosts."
    echo "Le mot de passe (sudo) va être demandé :"
    echo "$IP $DOMAIN" | sudo tee -a /etc/hosts
fi

#Vérification du démarrage des services
echo "======================================================="
echo " Attente du démarrage des services (cela peut prendre 1 à 3 minutes)..."
echo "======================================================="
sleep 5

echo "Vérification des tâches d'initialisation (Jobs)..."
kubectl wait --for=condition=complete job --all -n pokemon-aube-crepuscule --timeout=120s

echo "Vérification des microservices..."
kubectl wait --for=condition=Ready pod -l '!job-name' -n pokemon-aube-crepuscule --timeout=300s

echo "Tous les pods sont 100% opérationnels !"
echo "======================================================="
echo "       ☀️ INSTALLATION TERMINÉE AVEC SUCCÈS ☀️"
echo "======================================================="
echo "Pour voir l'état des services : kubectl get pods -n pokemon-aube-crepuscule -w"
echo "Sinon  : http://$DOMAIN"