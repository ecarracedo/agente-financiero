from src.database import db, BibliographyItem

def fix_db():
    print("Connecting to DB...")
    db.connect()
    print("Creating BibliographyItem table...")
    db.create_tables([BibliographyItem], safe=True)
    print("Done.")

if __name__ == "__main__":
    fix_db()
