#!/bin/bash
#
# Setup Cloudflare Vectorize Index
#
# This script creates the Vectorize index for NeetLogIQ AI search.
# Run this ONCE before generating embeddings.
#
# Usage:
#   chmod +x scripts/setup-vectorize.sh
#   ./scripts/setup-vectorize.sh
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NeetLogIQ Cloudflare Vectorize Setup${NC}"
echo "========================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
    echo -e "${GREEN}✓${NC} Found .env.local"
    export $(grep -v '^#' .env.local | xargs)
else
    echo -e "${RED}✗${NC} .env.local not found!"
    echo "Please create .env.local from .env.cloudflare.example"
    exit 1
fi

# Check required variables
if [ -z "$NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${RED}✗${NC} NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID not set in .env.local"
    exit 1
fi

if [ -z "$NEXT_PUBLIC_AUTORAG_API_KEY" ]; then
    echo -e "${RED}✗${NC} NEXT_PUBLIC_AUTORAG_API_KEY not set in .env.local"
    exit 1
fi

# Configuration
ACCOUNT_ID="$NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID"
API_TOKEN="$NEXT_PUBLIC_AUTORAG_API_KEY"
INDEX_NAME="${NEXT_PUBLIC_AUTORAG_INDEX:-neetlogiq-vectors}"
DIMENSIONS=768  # BGE-large-en-v1.5 produces 768-dimensional embeddings
METRIC="cosine" # Cosine similarity for semantic search

echo -e "${BLUE}Configuration:${NC}"
echo "  Account ID: $ACCOUNT_ID"
echo "  Index Name: $INDEX_NAME"
echo "  Dimensions: $DIMENSIONS"
echo "  Metric: $METRIC"
echo ""

# Create the Vectorize index
echo -e "${YELLOW}Creating Vectorize index...${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/vectorize/indexes" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$INDEX_NAME\",
    \"config\": {
      \"dimensions\": $DIMENSIONS,
      \"metric\": \"$METRIC\"
    }
  }")

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
    echo -e "${GREEN}✓${NC} Vectorize index created successfully!"
    echo ""
    echo -e "${BLUE}Index Details:${NC}"
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${GREEN}✓${NC} Setup complete!"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Generate embeddings:"
    echo "     ${BLUE}npx tsx scripts/generate-embeddings.ts${NC}"
    echo ""
    echo "  2. Test AI search:"
    echo "     Visit /search on your website"
    echo ""
    echo "  3. Monitor usage:"
    echo "     https://dash.cloudflare.com/$ACCOUNT_ID/workers/vectorize"
elif [ "$HTTP_CODE" == "400" ]; then
    # Check if index already exists
    if echo "$BODY" | grep -q "already exists"; then
        echo -e "${YELLOW}⚠${NC}  Index '$INDEX_NAME' already exists"
        echo ""
        echo "Do you want to:"
        echo "  1. Skip and use existing index"
        echo "  2. Delete and recreate index (⚠️  DESTROYS ALL VECTORS)"
        echo ""
        read -p "Enter choice (1 or 2): " CHOICE

        if [ "$CHOICE" == "2" ]; then
            echo -e "${YELLOW}Deleting existing index...${NC}"

            DELETE_RESPONSE=$(curl -s -w "\n%{http_code}" -X DELETE \
              "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/vectorize/indexes/$INDEX_NAME" \
              -H "Authorization: Bearer $API_TOKEN")

            DELETE_CODE=$(echo "$DELETE_RESPONSE" | tail -n1)

            if [ "$DELETE_CODE" == "200" ] || [ "$DELETE_CODE" == "204" ]; then
                echo -e "${GREEN}✓${NC} Index deleted"
                echo -e "${YELLOW}Creating new index...${NC}"

                # Recreate
                exec "$0" "$@"
            else
                echo -e "${RED}✗${NC} Failed to delete index"
                echo "$(echo "$DELETE_RESPONSE" | sed '$d')"
                exit 1
            fi
        else
            echo -e "${GREEN}✓${NC} Using existing index"
            exit 0
        fi
    else
        echo -e "${RED}✗${NC} Failed to create index (HTTP $HTTP_CODE)"
        echo "$BODY"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} Failed to create index (HTTP $HTTP_CODE)"
    echo "$BODY"
    exit 1
fi
