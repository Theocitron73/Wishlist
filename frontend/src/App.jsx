import { useState, useEffect } from 'react';
import './App.css';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://wishlist-potp.onrender.com';

if (!API_BASE_URL) {
  console.error("ERREUR CRITIQUE : REACT_APP_API_URL n'est pas définie dans Vercel !");
}

const SortableItem = ({ item, index, deleteItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  
  const style = { 
    transform: CSS.Transform.toString(transform), 
    transition: transition,
    // On enlève cursor: 'grab' d'ici car ce n'est plus toute la div qui est draggable
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: '15px'
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="modern-card" 
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        
        {/* L'icône de déplacement (Grip) avec les listeners */}
        <span 
          {...attributes} 
          {...listeners} 
          style={{ 
            color: '#475569', 
            fontSize: '20px', 
            userSelect: 'none',
            cursor: 'grab' // C'est ici qu'on indique que c'est déplaçable
          }}
        >
          ⋮⋮
        </span>

        {/* Le reste de ton contenu (numéro, image, texte...) */}
        <div style={{ background: '#3b82f6', color: 'white', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
          {index + 1}
        </div>

        <img src={item.image_url} alt="" style={{ width: '60px', height: '60px', borderRadius: '12px', objectFit: 'cover' }} />
        <div>
          <strong style={{ fontSize: '1.1rem' }}>{item.title}</strong>
          <p style={{ color: '#3b82f6', fontWeight: 'bold' }}>{item.price} €</p>
          <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Voir le site
          </a>
        </div>
      </div>
      
      {/* Le bouton fonctionne maintenant car il n'est plus "couvert" par les listeners */}
      <button className="delete-btn" onClick={() => deleteItem(item.id)}>
        Supprimer
      </button>
    </div>
  );
};
function App() {
  const [user, setUser] = useState(localStorage.getItem('username'));
  
  // 1. On récupère le pseudo depuis l'URL (ex: monapp.com/?view=jean)
  const urlParams = new URLSearchParams(window.location.search);
  const viewUser = urlParams.get('view');
  const [usernameInput, setUsernameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [product, setProduct] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const under100 = wishlist.filter(item => parseFloat(item.price) < 100);
  const over100 = wishlist.filter(item => parseFloat(item.price) >= 100);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('username');
    if (savedUser) setUser(savedUser);
  }, []);

  useEffect(() => {
  console.log("Valeur de user dans App:", user); // Regarde si c'est null dans la console F12
  if (user) {

    fetch(`${API_BASE_URL}/items/${user}`)
      .then(res => res.json())
      .then(data => {
        console.log("Items reçus:", data);
        setWishlist(data);
      })
      .catch(err => console.error("Erreur chargement:", err));
  }
}, [user]);

  const deleteItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/items/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setWishlist(wishlist.filter(item => item.id !== id));
      } else {
        showToast("Erreur lors de la suppression.");
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleLogin = async () => {
    if (!usernameInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput })
      });
      const data = await res.json();
      if (data.username) {
        localStorage.setItem('username', data.username);
        setUser(data.username);
      }
    } catch (error) {
      console.error("Erreur de connexion :", error);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${API_BASE_URL}/extract-metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      if (!data.title) throw new Error("Données incomplètes");
      setProduct(data);
    } catch (error) {
      setProduct({ title: "", image: "", price: "", url: url });
      showToast("Extraction automatique impossible. Tu peux remplir les détails manuellement ci-dessous.");
    } finally {
      clearTimeout(id);
      setLoading(false);
    }
  };

  const saveToDatabase = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/save-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: product.title,
          url: product.url,
          image_url: product.image || "",
          price: product.price || "0",
          username: user
        })
      });
      if (response.ok) {
        showToast("Produit enregistré avec succès !");
        setProduct(null);
        setUrl('');
        const res = await fetch(`${API_BASE_URL}/items/${user}`);
        const data = await res.json();
        setWishlist(data);
      } else {
        showToast("Erreur lors de l'enregistrement.");
      }
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

const handleDragEnd = async (event) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  // 1. Calculer le nouvel ordre localement
  let newWishlist;
  setWishlist((items) => {
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    newWishlist = arrayMove(items, oldIndex, newIndex);
    return newWishlist;
  });

  // 2. Envoyer le nouvel ordre au serveur
  try {
    await fetch(`${API_BASE_URL}/update-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // On envoie juste la liste des IDs dans le nouvel ordre
        items: newWishlist.map((item, index) => ({ id: item.id, order: index }))
      })
    });
  } catch (error) {
    console.error("Erreur sauvegarde ordre:", error);
  }
};

if (viewUser) {
    return <PublicView username={viewUser} />;
  }

  if (!user) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Bienvenue 👋</h2>
        <p style={{ color: '#94a3b8', marginBottom: '30px' }}>
          Connecte-toi à ton espace Wishlist pour commencer.
        </p>
        
        <input 
          className="input-field" 
          value={usernameInput} 
          onChange={(e) => setUsernameInput(e.target.value)} 
          placeholder="Entre ton pseudo" 
          onKeyPress={(e) => e.key === 'Enter' && handleLogin()} // Petit bonus : touche Entrée
        />
        
        <button 
          className="primary-btn" 
          onClick={handleLogin}
          style={{ marginTop: '20px', height: '50px', fontSize: '1rem' }}
        >
          Accéder à mon espace
        </button>
      </div>
    </div>
  );
}

return (
  <div className="modern-container">
<header style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginBottom: '40px',
  padding: '20px 30px',
  background: '#ffffff',
  borderRadius: '24px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
}}>
  <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: '#0f172a' }}>
    Ma Wishlist <span style={{ color: '#3b82f6' }}>🚀</span>
  </h1>
  
  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px',
      padding: '6px 14px',
      background: '#f1f5f9',
      borderRadius: '12px',
      fontSize: '0.9rem'
    }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></div>
      <span style={{ fontWeight: '500', color: '#475569' }}>
        Connecté en tant que <strong style={{ color: '#0f172a' }}>{user}</strong>
      </span>
    </div>
    
    <button 
      onClick={() => { localStorage.removeItem('username'); setUser(null); }}
      style={{
        border: 'none',
        background: '#fee2e2',
        color: '#ef4444',
        padding: '8px 16px',
        borderRadius: '12px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseOver={(e) => e.target.style.background = '#fecaca'}
      onMouseOut={(e) => e.target.style.background = '#fee2e2'}
    >
      Déconnexion
    </button>
  </div>
</header>

    <div className="dashboard-grid">
      {/* Panneau de gauche */}
<aside>
  <div className="modern-card">
    <h3>Ajouter un produit</h3>
    <input className="input-field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Colle l'URL ici..." />
    <button className="primary-btn" onClick={handleAnalyze} disabled={loading}>
      {loading ? "Analyse en cours..." : "Analyser l'URL"}
    </button>
  </div>

  {product && (
    <div className="modern-card" style={{ border: '2px solid #3b82f6' }}>
      <h3>Détails</h3>
      
      {/* Visualisation de l'image ou champ d'édition */}
      {product.image ? (
        <div style={{ marginBottom: '15px' }}>
          <img 
            src={product.image} 
            alt="Aperçu" 
            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px' }} 
          />
        </div>
      ) : (
        <input 
          className="input-field" 
          placeholder="URL de l'image (si manquante)" 
          onChange={(e) => setProduct({...product, image: e.target.value})} 
        />
      )}

      <input className="input-field" value={product.title} onChange={(e) => setProduct({...product, title: e.target.value})} />
      <input className="input-field" value={product.price || ""} placeholder="Prix (€)" onChange={(e) => setProduct({...product, price: e.target.value})} />
      <button className="primary-btn" onClick={saveToDatabase}>Enregistrer</button>
    </div>
  )}
</aside>



      {/* Panneau de droite */}
<main>
<button 
  className="primary-btn" 
  onClick={() => {
    // On génère l'URL avec le paramètre ?view=
    const shareUrl = `${window.location.origin}/?view=${user}`;
    
    navigator.clipboard.writeText(shareUrl);
    showToast("Lien de partage copié : " + shareUrl);
  }}
>
  Partager ma liste
</button>
  {/* SECTION MOINS DE 100€ */}
  <h2>Budget (-100€)</h2>
  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={under100} strategy={verticalListSortingStrategy}>
      {under100.map((item, index) => (
        <SortableItem key={item.id} item={item} index={index} deleteItem={deleteItem} />
      ))}
    </SortableContext>
  </DndContext>

  {/* SECTION PLUS DE 100€ */}
  <h2 style={{ marginTop: '40px' }}>Budget (+100€)</h2>
  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={over100} strategy={verticalListSortingStrategy}>
      {over100.map((item, index) => (
        <SortableItem key={item.id} item={item} index={index} deleteItem={deleteItem} />
      ))}
    </SortableContext>
  </DndContext>
</main>
    </div>

{toast.show && (
  <div style={{
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: '#1e293b', // Couleur sombre moderne
    color: 'white',
    padding: '16px 24px',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    zIndex: 1000,
    animation: 'fadeIn 0.3s'
  }}>
    {toast.message}
  </div>
)}

  </div>




);



}


function PublicView({ username }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/items/${username}`)
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(err => console.error("Erreur:", err));
  }, [username]);

  const under100 = items.filter(item => parseFloat(item.price) < 100);
  const over100 = items.filter(item => parseFloat(item.price) >= 100);

const renderSection = (title, list, color) => (
  <section style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
    <h2 style={{ fontSize: '0.9rem', marginBottom: '15px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
      {title}
    </h2>
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
      gap: '12px',
      overflowY: 'auto',
      paddingRight: '5px'
    }}>
      {list.map((item, index) => (
        <div key={item.id} style={{ 
          aspectRatio: '1 / 1',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
          position: 'relative' // Pour positionner les éléments par-dessus
        }}>
          {/* Numéro de préférence */}
          <div style={{ 
            position: 'absolute', top: '8px', left: '8px', zIndex: 1,
            background: color, color: 'white', padding: '2px 6px', 
            borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800'
          }}>#{index + 1}</div>

          <img src={item.image_url} style={{ width: '100%', height: '55%', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
          
          <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: 'auto', color: '#64748b' }}>
            {item.title}
          </div>
          
       <div style={{ 
  display: 'flex', 
  justifyContent: 'space-between', 
  alignItems: 'center', 
  marginTop: 'auto', // Pousse le bloc vers le bas du carré
  paddingTop: '10px'
}}>
  {/* Le prix est bien là */}
  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: color }}>
    {item.price} €
  </span>
  
  {/* Lien avec animation */}
  <a 
    href={item.url} 
    target="_blank" 
    rel="noreferrer" 
    style={{ 
      fontSize: '0.7rem', 
      textDecoration: 'none', 
      color: '#64748b', 
      background: '#f1f5f9', 
      padding: '4px 10px', 
      borderRadius: '6px',
      transition: 'all 0.2s ease',
      display: 'inline-block'
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.background = '#e2e8f0';
      e.currentTarget.style.color = '#1e293b';
      e.currentTarget.style.transform = 'scale(1.05)';
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.background = '#f1f5f9';
      e.currentTarget.style.color = '#64748b';
      e.currentTarget.style.transform = 'scale(1)';
    }}
  >
    Voir le produit
  </a>
</div>
        </div>
      ))}
    </div>
  </section>
);

  return (
    <div className="modern-container" style={{ margin: '0 auto', padding: '40px 20px' }}>
      <header style={{ 
        textAlign: 'center', 
        marginBottom: '50px', 
        padding: '25px 20px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.05)',
        boxShadow: '0 4px 12px -2px rgba(0,0,0,0.05)'
      }}>
        <div style={{ 
          display: 'inline-block', 
          background: '#3b82f6', 
          color: 'white', 
          padding: '3px 12px', 
          borderRadius: '15px', 
          fontSize: '0.7rem', 
          fontWeight: '700',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Wishlist Publique
        </div>
        <h1 style={{ fontSize: '2rem', margin: '0', color: '#0f172a', fontWeight: '800' }}>
          Les envies de <span style={{ color: '#3b82f6' }}>{username}</span>
        </h1>
        <p style={{ color: '#64748b', marginTop: '5px', fontSize: '0.95rem' }}>
          Une sélection d'objets choisis avec soin.
        </p>
      </header>

     {/* Division avec bordure de séparation */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1px 1fr', // La colonne centrale (1px) sert de trait
        gap: '40px',
        alignItems: 'start'
      }}>
        {renderSection("Budget (-100€)", under100, "#3b82f6")}
        
        {/* La ligne de séparation */}
        <div style={{ background: '#e2e8f0', height: '100%' }}></div>
        
        {renderSection("Budget (+100€)", over100, "#8b5cf6")}
      </div>
    </div>
  );





}

export default App;


