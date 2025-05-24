#!/bin/bash

# Script to push the dashboard to GitHub

echo "Pushing dashboard to GitHub..."
echo "You'll be prompted for your GitHub credentials."
echo ""

# Remove the current remote with the non-working token
git remote remove origin

# Add the remote without token (will prompt for credentials)
git remote add origin https://github.com/anishkganesh/Looki.git

# Push to GitHub (force push to replace everything)
echo "Pushing code to GitHub (this will replace all existing code)..."
git push -u origin main --force

echo ""
echo "✅ Done! Your code should now be on GitHub."
echo ""
echo "Next steps:"
echo "1. Go to https://vercel.com and import the repository"
echo "2. Add all the environment variables from the .env file"
echo "3. Don't forget to generate a secure CRON_SECRET value!" 