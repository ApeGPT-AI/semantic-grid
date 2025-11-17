#!/bin/bash
set -e

REGISTRY="205930631794.dkr.ecr.us-east-1.amazonaws.com"
IMAGE_NAME="fm_app"
PATCH_FILE="apps/fm-app/k8s/overlays/cloud/patch.yml"

# Extract current version from patch.yml (macOS compatible)
CURRENT_VERSION=$(grep "image:" "$PATCH_FILE" | grep "$IMAGE_NAME" | sed -E 's/.*fm_app:([0-9]+\.[0-9]+).*/\1/' || echo "0.0")

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

kubectl config use-context arn:aws:eks:us-east-1:205930631794:cluster/apegpt-cl1

echo "Building and deploying fm-app..."
echo "Image: $FULL_IMAGE"

# Build the image from repo root
docker buildx build --platform linux/amd64 \
  -f apps/fm-app/Dockerfile \
  -t "$FULL_IMAGE" \
  .

# Push the image
docker push "$FULL_IMAGE"

# Update the patch.yml with new image
sed -i.bak "s|image: \"$REGISTRY/$IMAGE_NAME:.*\"|image: \"$FULL_IMAGE\"|" "$PATCH_FILE"
rm "${PATCH_FILE}.bak"

echo "Image pushed: $FULL_IMAGE"
echo "Updated patch.yml with version $NEW_VERSION"

# Apply kustomization
echo "Applying to Kubernetes..."
kubectl apply -k apps/fm-app/k8s/overlays/cloud -n prod

echo "Deployment complete!"
echo "Don't forget to commit the updated patch.yml:"
echo "  git add $PATCH_FILE"
echo "  git commit -m 'Deploy fm-app v$NEW_VERSION'"
echo ""
echo "Check status with: kubectl get pods -n prod -l app=fm-app"
