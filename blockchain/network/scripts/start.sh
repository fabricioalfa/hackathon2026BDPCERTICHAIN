#!/usr/bin/env bash
# ============================================================
# CERTICHAIN BDP - Arranque de la red Fabric de prueba
#
# Crea el channel, empaqueta e instala el chaincode en Go,
# y lo aprueba/commitea en Org1.
#
# Uso:
#   ./start.sh                 (arranca todo)
#   ./start.sh down            (baja la red)
#   ./start.sh reset           (baja, borra y vuelve a arrancar)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$SCRIPT_DIR"
CHANNEL="certchain"
CHAINCODE_NAME="certchain"
CHAINCODE_LANG="golang"
CC_VERSION="1.0"
CC_SEQUENCE="1"
CLI="docker exec -i certchain-cli"

# ---------- helpers ----------
copy_org_crypto() {
  # La test-network oficial de fabric-samples genera las MSP/certs.
  # Si no existen, se debe correr la test-network una vez:
  #   cd fabric-samples/test-network && ./network.sh createChannel -c certchain
  # y luego copiar ./organizations a este directorio.
  if [ ! -d "$NETWORK_DIR/organizations/peerOrganizations" ]; then
    echo "ERROR: no se encontraron credenciales en $NETWORK_DIR/organizations"
    echo "Genera las credenciales con la test-network oficial de fabric-samples:"
    echo "  git clone https://github.com/hyperledger/fabric-samples"
    echo "  cd fabric-samples && curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh"
    echo "  bash install-fabric.sh --fabric-version 2.5.9"
    echo "  cd test-network && ./network.sh createChannel -c certchain"
    echo "  cp -r organizations $NETWORK_DIR/"
    exit 1
  fi
}

down() {
  echo "==> Bajando red Fabric..."
  docker compose -f "$NETWORK_DIR/docker-compose.yml" down -v --remove-orphans
}

create_channel() {
  echo "==> Creando channel '$CHANNEL'..."
  $CLI peer channel create \
    -o orderer.example.com:7050 \
    -c "$CHANNEL" \
    -f ./channel-artifacts/channel.tx \
    --tls --cafile /etc/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    --outputBlock ./channel-artifacts/"$CHANNEL".block
}

join_channel() {
  echo "==> Uniendo peer al channel..."
  $CLI peer channel join -b ./channel-artifacts/"$CHANNEL".block
}

install_chaincode() {
  echo "==> Empaquetando e instalando chaincode Go..."
  $CLI peer lifecycle chaincode package "$CHAINCODE_NAME".tar.gz \
    --path ./../chaincode \
    --lang "$CHAINCODE_LANG" \
    --label "${CHAINCODE_NAME}_${CC_VERSION}"

  $CLI peer lifecycle chaincode install "$CHAINCODE_NAME".tar.gz
}

approve_and_commit() {
  echo "==> Aprobando chaincode..."
  PACKAGE_ID=$($CLI peer lifecycle chaincode calculatepackageid "$CHAINCODE_NAME".tar.gz)

  $CLI peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 --channelID "$CHANNEL" \
    --name "$CHAINCODE_NAME" --version "$CC_VERSION" --sequence "$CC_SEQUENCE" \
    --init-required --package-id "$PACKAGE_ID" \
    --tls --cafile /etc/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

  echo "==> Commit del chaincode..."
  $CLI peer lifecycle chaincode commit \
    -o orderer.example.com:7050 --channelID "$CHANNEL" \
    --name "$CHAINCODE_NAME" --version "$CC_VERSION" --sequence "$CC_SEQUENCE" \
    --init-required \
    --tls --cafile /etc/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
}

init_chaincode() {
  echo "==> Inicializando chaincode..."
  $CLI peer chaincode invoke \
    -o orderer.example.com:7050 -C "$CHANNEL" -n "$CHAINCODE_NAME" \
    --isInit -c '{"Args":[]}' \
    --tls --cafile /etc/hyperledger/fabric/peer/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem || true
}

# ---------- main ----------
case "${1:-up}" in
  down) down ;;
  reset) down; up ;;
  up)
    copy_org_crypto
    down || true
    echo "==> Levantando contenedores Fabric..."
    docker compose -f "$NETWORK_DIR/docker-compose.yml" up -d
    echo "==> Esperando a que los servicios esten listos..."
    sleep 10
    create_channel
    join_channel
    install_chaincode
    approve_and_commit
    init_chaincode
    echo "===================================================="
    echo " Red Fabric lista. Channel=$CHANNEL Chaincode=$CHAINCODE_NAME"
    echo " Peer: peer0.org1.example.com:7051"
    echo "===================================================="
    ;;
esac
