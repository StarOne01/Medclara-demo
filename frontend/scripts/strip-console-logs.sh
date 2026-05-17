
#!/bin/bash

# Script to strip out console.log statements from TypeScript/JavaScript files
# Usage: ./scripts/strip-console-logs.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

FILES_PROCESSED=0
LOGS_REMOVED=0

# Exclude directories
EXCLUDE_DIRS="node_modules|\.next|\.git|dist|build|\.vercel"

echo "🔍 Scanning for console.log statements..."
echo ""

# Find all matching files
while IFS= read -r file; do
  if [ -f "$file" ]; then
    # Count console.* occurrences before
    count=$(grep -o "^[[:space:]]*console\." "$file" 2>/dev/null | wc -l)
    
    if [ "$count" -gt 0 ]; then
      # Remove any line starting with console (console.log, console.error, etc.)
      sed -i.bak '/^[[:space:]]*console\./d' "$file"
      
      # Remove the backup
      rm "$file.bak"
      
      ((FILES_PROCESSED++))
      ((LOGS_REMOVED += count))
      
      echo "✓ ${file#$ROOT_DIR/} ($count logs removed)"
    fi
  fi
done < <(find "$ROOT_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | grep -v -E "$EXCLUDE_DIRS")

echo ""
echo "✨ Complete!"
echo "📊 Summary:"
echo "  - Files processed: $FILES_PROCESSED"
echo "  - console.log statements removed: $LOGS_REMOVED"
