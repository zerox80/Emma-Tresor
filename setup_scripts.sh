#!/bin/bash
# Script um die Backup/Restore Scripts ausführbar zu machen
chmod +x backup_db.sh
chmod +x restore_db.sh
echo "✅ Scripts sind jetzt ausführbar"
echo "Verwendung:"
echo "  ./backup_db.sh                    # Backup erstellen"  
echo "  ./restore_db.sh <backup_file>     # Backup wiederherstellen"
