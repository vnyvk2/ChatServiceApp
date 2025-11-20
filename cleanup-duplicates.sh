#!/bin/bash

# Cleanup Script for Removing Duplicate Package Structure
# This script removes the duplicate com.chatservice package

echo "============================================"
echo "ChatServiceApp - Package Cleanup Script"
echo "============================================"
echo ""
echo "This script will remove the duplicate package:"
echo "  src/main/java/com/chatservice/"
echo ""
echo "The main implementation in com.example.chatservice will be preserved."
echo ""

# Check if we're in the right directory
if [ ! -f "pom.xml" ]; then
    echo "Error: pom.xml not found. Please run this script from the project root directory."
    exit 1
fi

# Check if the duplicate directory exists
if [ ! -d "src/main/java/com/chatservice" ]; then
    echo "Info: Duplicate package 'com.chatservice' not found. Cleanup may have already been done."
    exit 0
fi

# Confirm with user
read -p "Are you sure you want to delete src/main/java/com/chatservice/? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""
echo "Removing duplicate package structure..."

# Remove the duplicate directory
rm -rf src/main/java/com/chatservice/

if [ $? -eq 0 ]; then
    echo "✅ Successfully removed src/main/java/com/chatservice/"
    echo ""
    echo "Next steps:"
    echo "  1. Run: mvn clean install"
    echo "  2. Test: mvn spring-boot:run"
    echo "  3. Commit: git add . && git commit -m 'Remove duplicate com.chatservice package'"
    echo "  4. Push: git push"
    echo ""
else
    echo "❌ Error removing directory"
    exit 1
fi

echo "============================================"
echo "Cleanup Complete!"
echo "============================================"
