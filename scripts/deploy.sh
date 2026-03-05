#!/bin/bash

echo "🌊 ========================================="
echo "   AQUA-CERT DEPLOYMENT SCRIPT"
echo "   ========================================="

# Colori
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

cd ~/aqua-cert

# 1. Pubblica Smart Contracts
echo -e "\n${BLUE}📦 Step 1: Publishing Smart Contracts...${NC}"
cd aqua_cert
iota move build

PUBLISH_OUTPUT=$(iota client publish --gas-budget 100000000 --json 2>/dev/null | sed '/^\[/d')

# Estrai Package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.type=="published") | .packageId')
echo -e "${GREEN}✅ Package ID: $PACKAGE_ID${NC}"

# Estrai Object IDs
ADMIN_CAP=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("AdminCap")) | .objectId')
CERTIFIER_CAP=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("CertifierCap")) | .objectId')
TREASURY_CAP=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("TreasuryCap")) | .objectId')
TOKEN_INFO=$(echo "$PUBLISH_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("WaterTokenInfo")) | .objectId')

echo -e "${GREEN}✅ AdminCap: $ADMIN_CAP${NC}"
echo -e "${GREEN}✅ CertifierCap: $CERTIFIER_CAP${NC}"
echo -e "${GREEN}✅ TreasuryCap: $TREASURY_CAP${NC}"
echo -e "${GREEN}✅ TokenInfo: $TOKEN_INFO${NC}"

# 2. Crea Registry
echo -e "\n${BLUE}📦 Step 2: Creating Water Registry...${NC}"
REGISTRY_OUTPUT=$(iota client call \
  --package $PACKAGE_ID \
  --module water_registry \
  --function create_registry \
  --args $ADMIN_CAP "Demo Company" "0x6" \
  --gas-budget 10000000 \
  --json 2>/dev/null | sed '/^\[/d')

REGISTRY_ID=$(echo "$REGISTRY_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("WaterRegistry")) | .objectId')
echo -e "${GREEN}✅ Registry ID: $REGISTRY_ID${NC}"

# 3. Registra Dispositivo
echo -e "\n${BLUE}📦 Step 3: Registering IoT Device...${NC}"
DEVICE_OUTPUT=$(iota client call \
  --package $PACKAGE_ID \
  --module water_registry \
  --function register_device \
  --args $ADMIN_CAP $REGISTRY_ID "SENSOR-001" "Demo Location" "irrigation" \
  --gas-budget 10000000 \
  --json 2>/dev/null | sed '/^\[/d')

DEVICE_CAP=$(echo "$DEVICE_OUTPUT" | jq -r '.objectChanges[] | select(.objectType // "" | contains("DeviceCap")) | .objectId')
echo -e "${GREEN}✅ Device Cap: $DEVICE_CAP${NC}"

# 4. Esporta private key
echo -e "\n${BLUE}📦 Step 4: Updating backend .env...${NC}"
cd ../backend
ACTIVE_ADDRESS=$(iota client active-address 2>/dev/null | tail -1)
PRIVATE_KEY_BECH32=$(iota keytool export "$ACTIVE_ADDRESS" --json 2>/dev/null | jq -r '.exportedPrivateKey')
PRIVATE_KEY_HEX=$(python3 -c "
CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
def bech32_decode(bech):
    bech = bech.lower()
    pos = bech.rfind('1')
    data = [CHARSET.find(x) for x in bech[pos+1:]]
    return data[:-6]
def convertbits(data, frombits, tobits):
    acc, bits, ret = 0, 0, []
    max_acc = (1 << (frombits + tobits - 1)) - 1
    for value in data:
        acc = ((acc << frombits) | value) & max_acc
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & ((1 << tobits) - 1))
    return ret
data = bech32_decode('$PRIVATE_KEY_BECH32')
decoded = convertbits(data, 5, 8)
print(bytes(decoded[1:33]).hex())
")

cat > .env << EOF
IOTA_NETWORK_URL=https://api.testnet.iota.cafe
PACKAGE_ID=$PACKAGE_ID
ADMIN_CAP_ID=$ADMIN_CAP
DEVICE_CAP_ID=$DEVICE_CAP
REGISTRY_ID=$REGISTRY_ID
CERTIFIER_CAP_ID=$CERTIFIER_CAP
TREASURY_CAP_ID=$TREASURY_CAP
TOKEN_INFO_ID=$TOKEN_INFO
PRIVATE_KEY=$PRIVATE_KEY_HEX
PORT=3001
SIMULATION_INTERVAL_MS=5000
EOF

echo -e "${GREEN}✅ .env updated${NC}"

# 5. Riepilogo
echo -e "\n${GREEN}🎉 ========================================="
echo "   DEPLOYMENT COMPLETE!"
echo "   ==========================================${NC}"
echo ""
echo "Package ID:     $PACKAGE_ID"
echo "Registry ID:    $REGISTRY_ID"
echo "AdminCap:       $ADMIN_CAP"
echo "DeviceCap:      $DEVICE_CAP"
echo "CertifierCap:   $CERTIFIER_CAP"
echo "TreasuryCap:    $TREASURY_CAP"
echo "TokenInfo:      $TOKEN_INFO"
echo ""
echo "Next steps:"
echo "1. cd ~/aqua-cert/backend && npm run dev"
echo "2. cd ~/aqua-cert/frontend && npm run dev"
echo "3. Open http://localhost:5173"
