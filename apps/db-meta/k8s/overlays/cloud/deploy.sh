#!/bin/bash
set -e

REGISTRY="205930631794.dkr.ecr.us-east-1.amazonaws.com"
IMAGE_NAME="dbmeta"
PATCH_FILE="apps/db-meta/k8s/overlays/cloud/patch.yml"

# Extract current version from patch.yml (macOS compatible)
CURRENT_VERSION=$(grep "image:" "$PATCH_FILE" | grep "$IMAGE_NAME" | sed -E 's/.*dbmeta:([0-9]+\.[0-9]+).*/\1/' || echo "0.0")

# Parse major and minor version
IFS='.' read -r MAJOR MINOR <<< "$CURRENT_VERSION"

# Increment minor version
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="$MAJOR.$NEW_MINOR"

# Allow manual version override
if [ -n "$1" ]; then
    NEW_VERSION="$1"
    echo "Using manual version: $NEW_VERSION"
else
    echo "Current version: $CURRENT_VERSION"
    echo "New version: $NEW_VERSION"
    read -p "Proceed with version $NEW_VERSION? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

FULL_IMAGE="$REGISTRY/$IMAGE_NAME:$NEW_VERSION"

echo "Building and deploying db-meta..."
echo "Image: $FULL_IMAGE"

# Build the image from repo root
docker buildx build --platform linux/amd64 \
  -f apps/db-meta/Dockerfile \
  -t "$FULL_IMAGE" \
  .

# Push the image
docker push "$FULL_IMAGE"

# Update the patch.yml with new image
sed -i.bak "s|image: \"$REGISTRY/$IMAGE_NAME:.*\"|image: \"$FULL_IMAGE\"|" "$PATCH_FILE"
rm "${PATCH_FILE}.bak"

echo "Image pushed: $FULL_IMAGE"
echo "Updated patch.yml with version $NEW_VERSION"

# Delete existing ETL job if it exists
echo "Cleaning up existing ETL job..."
kubectl delete job dbmeta-etl -n prod --ignore-not-found=true

# Apply kustomization
echo "Applying to Kubernetes..."
kubectl apply -k apps/db-meta/k8s/overlays/cloud -n prod

echo "Deployment complete!"
echo "Don't forget to commit the updated patch.yml:"
echo "  git add $PATCH_FILE"
echo "  git commit -m 'Deploy db-meta v$NEW_VERSION'"
echo ""
echo "Check status with: kubectl get pods -n prod -l app=dbmeta-app"
echo "Check ETL job with: kubectl get job dbmeta-etl -n prod"
