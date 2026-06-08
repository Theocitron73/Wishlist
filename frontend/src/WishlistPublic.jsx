// Exemple de composant pour le partage public
function WishlistPublic() {
  const { username } = useParams(); // Utilise react-router-dom pour récupérer le pseudo
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:8000/items/${username}`)
      .then(res => res.json())
      .then(data => setItems(data));
  }, [username]);

  return (
    <div className="modern-container">
      <h1>La Wishlist de {username} ✨</h1>
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
        {items.map(item => (
          <div key={item.id} className="modern-card" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={item.image_url} style={{ width: '80px', borderRadius: '12px', marginRight: '20px' }} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.price} €</p>
              <a href={item.url} target="_blank">Voir le produit</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}