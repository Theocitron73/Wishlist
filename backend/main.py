import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from playwright.async_api import async_playwright
from typing import List

load_dotenv()
# Remplace par ta vraie URL Neon que tu trouves dans ton dashboard
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("La variable DATABASE_URL n'est pas définie dans le fichier .env")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Définition de ta table User
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)

# Créer les tables dans la base si elles n'existent pas
Base.metadata.create_all(bind=engine)

# Fonction pour obtenir une session de base de données à chaque requête
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



# C'est ici que tu définis l'instance "app"
app = FastAPI()


ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
# Configuration CORS pour autoriser ton frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ta première route pour tester que tout fonctionne
@app.get("/")
def read_root():
    return {"message": "Le backend est opérationnel !"}




class URLRequest(BaseModel):
    url: str

# Ajoute le décorateur au-dessus de la fonction
@app.post("/extract-metadata") 
async def extract_metadata(request: URLRequest):
    api_url = f"https://api.microlink.io?url={request.url}"
    async with httpx.AsyncClient() as client:
        response = await client.get(api_url)
        data = response.json()
        return {
            "title": data['data'].get('title'),
            "image": data['data'].get('image', {}).get('url'),
            "url": request.url, "prerender": "true", "data": '{"price": "jsonld.offers.price"}'
        }

class UserRequest(BaseModel):
    username: str

@app.post("/login")
def login(user: UserRequest, db: Session = Depends(get_db)):
    # 1. Chercher l'utilisateur
    db_user = db.query(User).filter(User.username == user.username).first()
    
    # 2. Créer si inexistant
    if not db_user:
        db_user = User(username=user.username)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    return {"status": "success", "username": db_user.username, "user_id": db_user.id}




# 1. Modèle de la table 'Item'
class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    url = Column(String)
    image_url = Column(String)
    price = Column(String)
    order_index = Column(Integer, default=0) # Ajoute cette ligne
    owner_id = Column(Integer, ForeignKey("users.id"))

# Créer la table dans la base (si elle n'existe pas encore)
Base.metadata.create_all(bind=engine)

# 2. Modèle Pydantic pour recevoir les données
class ItemCreate(BaseModel):
    title: str
    url: str
    image_url: str
    price: str
    username: str # On utilise le pseudo pour retrouver le user_id

# 3. Route pour enregistrer
@app.post("/save-item")
def save_item(item: ItemCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == item.username).first()
    new_item = Item(
        title=item.title, url=item.url, image_url=item.image_url, 
        price=item.price, owner_id=user.id
    )
    db.add(new_item)
    db.commit()
    return {"status": "success"}


@app.get("/items/{username}")
def get_items(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return []
    
    # Ajout du .order_by(Item.order_index)
    items = db.query(Item).filter(Item.owner_id == user.id).order_by(Item.order_index).all()
    return items


@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    # On cherche l'item
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Produit non trouvé")
    
    # On supprime et on valide
    db.delete(item)
    db.commit()
    return {"status": "success"}


class OrderUpdate(BaseModel):
    items: List[dict] # Liste de {id: int, order: int}

@app.post("/update-order")
def update_order(data: OrderUpdate, db: Session = Depends(get_db)):
    for item_data in data.items:
        item = db.query(Item).filter(Item.id == item_data['id']).first()
        if item:
            item.order_index = item_data['order']
    db.commit()
    return {"status": "success"}