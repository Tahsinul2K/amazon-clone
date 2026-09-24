import { StrictMode, createContext, useContext, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import './styles.css';

const API_ORIGIN = 'http://localhost:5000';

async function request(path, options = {}) {
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers };
  let response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'include', ...options, headers });
  } catch {
    throw new Error('Unable to reach the server. Is the backend running on port 5000?');
  }
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(body?.error || body?.message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const api = {
  session: () => request('/session'),
  login: (role, body) => request(`/login/${role}`, { method: 'POST', body: JSON.stringify(body) }),
  register: (role, body) => request(`/register/${role}`, { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/logout', { method: 'POST' }),
  products: () => request('/products'),
  categories: () => request('/categories'),
  productsByCategory: (categoryId) => request(`/products/category/${categoryId}`),
  product: (id) => request(`/products/${id}`),
  sellerProducts: () => request('/seller/products'),
  discounts: () => request('/discounts'),
  createDiscount: (body) => request('/discounts', { method: 'POST', body: JSON.stringify(body) }),
  updateDiscount: (id, body) => request(`/discounts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDiscount: (id) => request(`/discounts/${id}`, { method: 'DELETE' }),
  assignProductDiscount: (productId, discountId) => request(`/products/${productId}/discount`, { method: 'PUT', body: JSON.stringify({ discountId }) }),
  removeProductDiscount: (productId) => request(`/products/${productId}/discount`, { method: 'DELETE' }),
  orders: () => request('/orders'),
  placeOrder: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  cart: () => request('/cart'),
  addToCart: (productId, quantity) => request('/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) }),
  removeCartItem: (unitId) => request(`/cart/items/${unitId}`, { method: 'DELETE' }),
  createProduct: (body) => request('/products/create', { method: 'POST', body: JSON.stringify(body) }),
  createProductMultipart: (formData) => request('/products/create', { method: 'POST', body: formData }),
  updateProduct: (id, formData) => request(`/products/${id}`, { method: 'PUT', body: formData }),
  addProductCategory: (productId, categoryId) => request(`/products/${productId}/categories/${categoryId}`, { method: 'POST' }),
  removeProductCategory: (productId, categoryId) => request(`/products/${productId}/categories/${categoryId}`, { method: 'DELETE' }),
  reviews: (productId) => request(`/product/${productId}/reviews`),
  postReview: (productId, body) => request(`/product/${productId}/review`, { method: 'POST', body: JSON.stringify(body) }),
  editReview: (productId, body) => request(`/product/${productId}/review`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteReview: (productId) => request(`/product/${productId}/review`, { method: 'DELETE' }),
  addresses: () => request('/addresses'),
  addAddress: (body) => request('/address', { method: 'POST', body: JSON.stringify(body) }),
  setCurrentAddress: (id) => request(`/address/${id}/current`, { method: 'PUT' }),
  deleteAddress: (id) => request(`/address/${id}`, { method: 'DELETE' }),
  uploadImages: (productId, formData) => request(`/products/${productId}/images`, { method: 'POST', body: formData }),
  primaryImage: (productId, imageId) => request(`/products/${productId}/images/${imageId}/primary`, { method: 'PUT' }),
  deleteImage: (imageId) => request(`/images/${imageId}`, { method: 'DELETE' }),
};

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const money = (value) => `$${Number(value).toFixed(2)}`;
const effectivePrice = (product) => Number(product?.effective_price ?? product?.price);
const imageUrl = (url) => (url ? (url.startsWith('http') ? url : `${API_ORIGIN}${url}`) : '');
function Loading() { return <p className="state">Loading...</p>; }
function ErrorMessage({ message }) { return <p className="state error" role="alert">{message}</p>; }

function ProductImage({ product, large = false }) {
  const primary = product?.images?.find((image) => image.isPrimary || image.is_primary) || product?.images?.[0];
  return primary ? <img className={`product-image ${large ? 'large' : ''}`} src={imageUrl(primary.imageUrl || primary.image_url)} alt={product.product_name} /> : <div className={`image-placeholder ${large ? 'large' : ''}`}><span>Product image</span></div>;
}

function Provider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => { const result = await api.session(); setSession(result.authenticated ? result : null); return result; };
  useEffect(() => { refresh().catch(() => setSession(null)).finally(() => setLoading(false)); }, []);
  const value = { session, loading, login: async (role, body) => { await api.login(role, body); return refresh(); }, logout: async () => { await api.logout(); setSession(null); } };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Header() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  return <header className="site-header"><div className="nav"><Link className="brand" to="/">amazon<span>clone</span></Link><nav>
    <Link to="/">Shop</Link>
    {session?.role === 'buyer' && <><Link to="/cart">Cart</Link><Link to="/buyer">Buyer dashboard</Link></>}
    {session?.role === 'seller' && <Link to="/seller">Seller dashboard</Link>}
    {session?.role === 'admin' && <Link to="/admin">Admin dashboard</Link>}
    {session ? <button className="link-button" onClick={async () => { await logout(); navigate('/'); }}>Sign out</button> : <><Link to="/login">Sign in</Link><Link className="nav-cta" to="/register/buyer">Create account</Link></>}
  </nav></div></header>;
}

function Guard({ role, children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main><Loading /></main>;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (session.role !== role) return <main><ErrorMessage message={`This page is only available to ${role}s.`} /></main>;
  return children;
}

function Home() {
  const { session } = useAuth();
  const [products, setProducts] = useState([]); const [categories, setCategories] = useState([]); const [selectedCategory, setSelectedCategory] = useState('all');
  const [error, setError] = useState(''); const [categoryError, setCategoryError] = useState(''); const [loading, setLoading] = useState(true); const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    if (!session) { setCategories([]); setCategoryError(''); return; }
    setCategoryLoading(true);
    api.categories().then((result) => setCategories(result.categories || [])).catch((e) => setCategoryError(e.message)).finally(() => setCategoryLoading(false));
  }, [session]);

  useEffect(() => {
    setLoading(true); setError('');
    const load = selectedCategory === 'all' ? api.products() : api.productsByCategory(selectedCategory);
    load.then(setProducts).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [selectedCategory]);

  const selectedCategoryName = categories.find((category) => String(category.category_id) === selectedCategory)?.category_name;
  return <main><section className="shop-heading"><div><p className="eyebrow">Marketplace</p><h1>Find something worth keeping.</h1><p className="muted">Browse products from independent sellers.</p></div><span className="catalog-count">{products.length} products</span></section>
    {session && <section className="category-toolbar" aria-label="Product categories"><div><p className="eyebrow">Browse by category</p><h2>{selectedCategoryName || 'All products'}</h2></div><label>Category<select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} disabled={categoryLoading || Boolean(categoryError)}><option value="all">All products</option>{categories.map((category) => <option key={category.category_id} value={category.category_id}>{category.category_name}</option>)}</select></label>{categoryError && <p className="error" role="alert">Categories are unavailable right now: {categoryError}</p>}{!categoryLoading && !categoryError && !categories.length && <p className="muted">No categories are available yet.</p>}</section>}
    {loading ? <Loading /> : error ? <ErrorMessage message={error} /> : products.length === 0 ? <p className="state">{selectedCategoryName ? `No products found in ${selectedCategoryName}.` : 'No products are available yet.'}</p> : <div className="product-grid">{products.map((product) => { const price = effectivePrice(product); const discounted = price < Number(product.price); return <article className="product-card" key={product.product_id}><Link to={`/products/${product.product_id}`}><ProductImage product={product} /></Link><div className="product-card-body"><div className="product-categories">{(product.categories || []).map((category) => <button type="button" key={category.categoryId} onClick={() => session && setSelectedCategory(String(category.categoryId))}>{category.categoryName}</button>)}</div><p className="seller-label">{discounted ? 'On sale now' : 'Available now'}</p><h2>{product.product_name}</h2><p className="truncate">{product.product_description}</p><div className="product-meta"><strong>{money(price)} {discounted && <del>{money(product.price)}</del>}</strong><span>{product.available_stock} in stock</span></div><Link className="button secondary-button" to={`/products/${product.product_id}`}>View details</Link></div></article>; })}</div>}
  </main>;
}

function ReviewPanel({ productId, session }) {
  const [reviews, setReviews] = useState([]); const [rating, setRating] = useState(5); const [text, setText] = useState(''); const [editing, setEditing] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const load = () => api.reviews(productId).then((result) => setReviews(result.reviews || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [productId]);
  const ownReview = reviews.find((review) => Number(review.buyer_id) === Number(session?.id));
  useEffect(() => { if (ownReview && !editing) { setRating(ownReview.rating); setText(ownReview.review_text || ''); } }, [ownReview, editing]);
  const submit = async (event) => { event.preventDefault(); setError(''); setMessage(''); try { if (ownReview) await api.editReview(productId, { rating: Number(rating), reviewText: text }); else await api.postReview(productId, { rating: Number(rating), reviewText: text }); setMessage('Review saved.'); setEditing(false); await load(); } catch (e) { setError(e.message); } };
  const remove = async () => { try { await api.deleteReview(productId); setMessage('Review deleted.'); setText(''); setEditing(false); await load(); } catch (e) { setError(e.message); } };
  return <section className="reviews"><div className="section-heading"><div><p className="eyebrow">Customer voice</p><h2>Reviews</h2></div><span>{reviews.length} reviews</span></div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success">{message}</p>}
    {reviews.length ? <div className="review-list">{reviews.map((review) => <article className="review" key={`${review.product_id}-${review.buyer_id}`}><div className="review-top"><strong>{review.buyer_name || 'Buyer'}</strong><span>{'★'.repeat(review.rating)}<i>{'★'.repeat(5 - review.rating)}</i></span></div><p>{review.review_text || 'No written comment.'}</p></article>)}</div> : <p className="muted">No reviews yet. Be the first verified buyer.</p>}
    {session?.role === 'buyer' && <form className="review-form" onSubmit={submit}><h3>{ownReview ? (editing ? 'Edit your review' : 'Your review') : 'Share your experience'}</h3>{(!ownReview || editing) && <><label>Rating<select value={rating} onChange={(e) => setRating(e.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}</select></label><label>Your review<textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What should another buyer know?" /></label><button>{ownReview ? 'Save changes' : 'Post review'}</button></>}{ownReview && !editing && <div className="form-actions"><button type="button" onClick={() => setEditing(true)}>Edit review</button><button type="button" className="danger-button" onClick={remove}>Delete</button></div>}</form>}
  </section>;
}

function Product() {
  const { id } = useParams(); const { session } = useAuth(); const [product, setProduct] = useState(null); const [quantity, setQuantity] = useState(1); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { api.product(id).then(setProduct).catch((e) => setError(e.message)); }, [id]);
  if (error) return <main><ErrorMessage message={error} /></main>; if (!product) return <main><Loading /></main>;
  const stock = Number(product.available_stock); const add = async () => { try { await api.addToCart(product.product_id, quantity); setMessage('Added to your cart.'); } catch (e) { setError(e.message); } };
  const price = effectivePrice(product); const discounted = price < Number(product.price);
  return <main><Link className="back-link" to="/">Back to shop</Link><section className="detail-layout"><div><ProductImage product={product} large /><div className="image-strip">{(product.images || []).map((image) => <img key={image.imageId || image.image_id} src={imageUrl(image.imageUrl || image.image_url)} alt="" />)}</div></div><section className="detail-copy"><p className="eyebrow">Product details</p><h1>{product.product_name}</h1><p className="detail-description">{product.product_description}</p><strong className="detail-price">{money(price)} {discounted && <del>{money(product.price)}</del>}</strong>{discounted && <span className="sale-label">Discount applied</span>}<p className="stock">{stock} available</p>{stock > 0 && <label>Quantity<select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>{Array.from({ length: Math.min(stock, 20) }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></label>}<button disabled={!stock || session?.role !== 'buyer'} onClick={add}>{stock ? 'Add to cart' : 'Out of stock'}</button>{!session && <p className="muted">Sign in as a buyer to purchase this product.</p>}{message && <p className="success">{message}</p>}</section></section><ReviewPanel productId={product.product_id} session={session} /></main>;
}

function Login() { const [role, setRole] = useState('buyer'); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const submit = async (event) => { event.preventDefault(); try { const result = await login(role, { email, password }); const requestedPath = location.state?.from; const destination = role === 'buyer' ? (requestedPath === '/cart' || requestedPath === '/buyer' ? requestedPath : '/buyer') : (requestedPath === '/seller' ? requestedPath : '/seller'); navigate(destination, { replace: true }); } catch (e) { setError(e.message); } }; return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Welcome back</p><h1>Sign in</h1><form onSubmit={submit}><label>Account type<select value={role} onChange={(e) => setRole(e.target.value)}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error">{error}</p>}<button>Sign in</button></form><p className="muted">Need an account? <Link to="/register/buyer">Create one</Link> or <Link to="/admin/login">sign in as admin</Link>.</p></section></main>; }

function Register({ role }) { const seller = role === 'seller'; const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '', businessAddress: '' }); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const navigate = useNavigate(); const change = (e) => setForm({ ...form, [e.target.name]: e.target.value }); const submit = async (event) => { event.preventDefault(); if (form.password !== form.confirm) return setError('Passwords do not match.'); try { await api.register(role, { fullName: form.fullName, email: form.email, password: form.password, ...(seller ? { businessAddress: form.businessAddress } : {}) }); setSuccess('Account created.'); setTimeout(() => navigate('/login'), 700); } catch (e) { setError(e.message); } }; return <main className="auth-page"><section className="auth-card"><p className="eyebrow">Join the marketplace</p><h1>Create a {role} account</h1><form onSubmit={submit}><label>Full name<input name="fullName" required value={form.fullName} onChange={change} /></label><label>Email<input name="email" type="email" required value={form.email} onChange={change} /></label>{seller && <label>Business address<input name="businessAddress" required value={form.businessAddress} onChange={change} /></label>}<label>Password<input name="password" type="password" minLength="8" required value={form.password} onChange={change} /></label><label>Confirm password<input name="confirm" type="password" required value={form.confirm} onChange={change} /></label>{error && <p className="error">{error}</p>}{success && <p className="success">{success}</p>}<button>Create account</button></form><p className="muted"><Link to={seller ? '/register/buyer' : '/register/seller'}>Register as a {seller ? 'buyer' : 'seller'}</Link> · <Link to="/login">Sign in</Link></p></section></main>; }

function Cart() {
  const [items, setItems] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhoneNumber, setReceiverPhoneNumber] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => Promise.all([
    api.cart().then((result) => setItems(result.cart || [])).catch((e) => setError(e.message)),
    api.addresses().then((result) => {
      const list = result.addresses || [];
      setAddresses(list);
      const current = list.find((address) => address.is_current) || list[0];
      setSelectedAddressId(current ? String(current.address_id) : '');
    }).catch((e) => setError(e.message))
  ]);

  useEffect(() => { load(); }, []);

  const grouped = Object.values((items || []).reduce((map, item) => {
    const current = map[item.product_id] || { ...item, units: [] };
    current.units.push(item.unit_id);
    map[item.product_id] = current;
    return map;
  }, {}));

  const total = grouped.reduce((sum, item) => sum + Number(item.price) * item.units.length, 0);

  const submitOrder = async (event) => {
    event.preventDefault();
    setError('');
    setCheckoutMessage('');

    if (!selectedAddressId) {
      setError('Choose a shipping address before checkout.');
      return;
    }

    if (!receiverName.trim()) {
      setError('Receiver name is required.');
      return;
    }

    if (!receiverPhoneNumber.trim()) {
      setError('Receiver phone number is required.');
      return;
    }

    try {
      const result = await api.placeOrder({
        addressId_: Number(selectedAddressId),
        receiverName: receiverName.trim(),
        receiverPhoneNumber: receiverPhoneNumber.trim()
      });

      setCheckoutMessage(result.message || 'Order placed successfully.');
      setSelectedAddressId('');
      setReceiverName('');
      setReceiverPhoneNumber('');
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!items) return <main><Loading /></main>;

  return <main><section className="page-heading"><div><p className="eyebrow">Your basket</p><h1>Cart</h1></div><Link className="back-link" to="/">Continue shopping</Link></section>{error && <ErrorMessage message={error} />}{!grouped.length ? <p className="state">Your cart is empty.</p> : <section className="cart-list">{grouped.map((item) => <article className="cart-row" key={item.product_id}><div><h2>{item.product_name}</h2><p>{money(item.price)} each · {item.units.length} unit(s)</p></div><div>{item.units.map((unitId) => <button className="small-button" key={unitId} onClick={async () => { await api.removeCartItem(unitId); load(); }}>Remove</button>)}</div></article>)}<div className="cart-total"><span>Total</span><strong>{money(total)}</strong></div><div className="checkout-panel"><h2>Checkout</h2><p className="muted">Cash on delivery only.</p><form className="compact-form" onSubmit={submitOrder}><label>Shipping address<select value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)}>{addresses.length ? addresses.map((address) => <option key={address.address_id} value={address.address_id}>{address.label}: {address.street}, {address.city}, {address.country}</option>) : <option value="">No saved addresses</option>}</select></label><label>Receiver name<input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Full name" /></label><label>Receiver phone number<input value={receiverPhoneNumber} onChange={(e) => setReceiverPhoneNumber(e.target.value)} placeholder="Phone number" /></label><button type="submit" disabled={!grouped.length}>Place order</button>{checkoutMessage && <p className="success">{checkoutMessage}</p>}</form></div></section>}</main>;
}

function AddressBook() { const [addresses, setAddresses] = useState([]); const [form, setForm] = useState({ label: 'Home', street: '', city: '', postalCode: '', country: '', isCurrent: true }); const [error, setError] = useState(''); const load = () => api.addresses().then((result) => setAddresses(result.addresses || [])).catch((e) => setError(e.message)); useEffect(() => { load(); }, []); const submit = async (event) => { event.preventDefault(); try { await api.addAddress({ ...form, isCurrent: Boolean(form.isCurrent) }); setForm({ label: 'Home', street: '', city: '', postalCode: '', country: '', isCurrent: false }); load(); } catch (e) { setError(e.message); } }; return <section className="dashboard-panel"><div className="section-heading"><div><p className="eyebrow">Shipping</p><h2>Address book</h2></div></div><form className="compact-form" onSubmit={submit}><input placeholder="Nickname, e.g. Home" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /><input placeholder="Street address" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /><div className="form-grid"><input placeholder="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /><input placeholder="Postal code" required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div><input placeholder="Country" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /><label className="check-label"><input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} /> Use as current shipping address</label><button>Add address</button></form>{error && <p className="error">{error}</p>}<div className="address-list">{addresses.map((address) => <article className={`address-item ${address.is_current ? 'selected' : ''}`} key={address.address_id}><div><strong>{address.label}</strong><p>{address.street}, {address.city}, {address.postal_code}, {address.country}</p></div><div className="form-actions">{address.is_current ? <span className="current-tag">Current</span> : <button className="small-button" onClick={() => api.setCurrentAddress(address.address_id).then(load).catch((e) => setError(e.message))}>Use this</button>}<button className="small-button danger-button" onClick={() => api.deleteAddress(address.address_id).then(load).catch((e) => setError(e.message))}>Delete</button></div></article>)}</div></section>; }

function Buyer() { return <Guard role="buyer"><main><section className="dashboard-hero"><p className="eyebrow">Buyer dashboard</p><h1>Your marketplace, organized.</h1><p className="muted">Manage shipping details and keep shopping from one place.</p></section><div className="dashboard-grid"><AddressBook /><section className="dashboard-panel"><p className="eyebrow">Quick start</p><h2>Ready for the next find?</h2><p className="muted">Explore products, add them to your cart, and leave verified reviews after delivery.</p><Link className="button" to="/">Browse products</Link></section></div></main></Guard>; }

function ImageManager({ product, onChanged }) { const [error, setError] = useState(''); const [message, setMessage] = useState(''); const upload = async (event) => { const data = new FormData(); [...event.target.files].forEach((file) => data.append('images', file)); try { const result = await api.uploadImages(product.product_id, data); setMessage(result.message); event.target.value = ''; onChanged(); } catch (e) { setError(e.message); } }; return <article className="seller-product"><div className="seller-product-info"><ProductImage product={product} /><div><h3>{product.product_name}</h3><p>{money(product.price)} · {product.available_stock} available</p></div></div><label className="upload-label">Add up to 5 images<input type="file" accept="image/*" multiple onChange={upload} /></label><div className="image-manager-list">{(product.images || []).map((image) => <div key={image.imageId || image.image_id}><img src={imageUrl(image.imageUrl || image.image_url)} alt="" /><button className="small-button" onClick={() => api.primaryImage(product.product_id, image.imageId || image.image_id).then(() => { setMessage('Primary image updated.'); onChanged(); }).catch((e) => setError(e.message))}>{image.isPrimary || image.is_primary ? 'Primary' : 'Set primary'}</button><button className="small-button danger-button" onClick={() => api.deleteImage(image.imageId || image.image_id).then(() => { setMessage('Image deleted.'); onChanged(); }).catch((e) => setError(e.message))}>Delete</button></div>)}</div>{error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}</article>; }

function Seller() { const [form, setForm] = useState({ name: '', description: '', price: '', stock: '0' }); const [products, setProducts] = useState([]); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const load = () => api.products().then(setProducts).catch((e) => setError(e.message)); useEffect(() => { load(); }, []); const submit = async (event) => { event.preventDefault(); try { const result = await api.createProduct({ ...form, price: Number(form.price), stock: Number(form.stock) }); setMessage(`${result.message}. You can now add images below.`); setForm({ name: '', description: '', price: '', stock: '0' }); load(); } catch (e) { setError(e.message); } }; return <main><section className="dashboard-hero seller-hero"><p className="eyebrow">Seller dashboard</p><h1>Build a storefront people trust.</h1><p className="muted">Create products, then give each one a strong visual identity.</p></section><div className="seller-layout"><form className="dashboard-panel compact-form" onSubmit={submit}><h2>Create product</h2><input name="name" placeholder="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea name="description" placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="form-grid"><input name="price" type="number" min="0.01" step="0.01" placeholder="Price" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><input name="stock" type="number" min="0" step="1" placeholder="Stock" required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div><button>Create product</button>{error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}</form><section><div className="section-heading"><div><p className="eyebrow">Catalog</p><h2>Products and images</h2></div></div>{products.length ? products.map((product) => <ImageManager key={product.product_id} product={product} onChanged={load} />) : <p className="state">Create your first product to manage images.</p>}</section></div></main>; }

function AdminLogin() { const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const { login } = useAuth(); const navigate = useNavigate(); const submit = async (event) => { event.preventDefault(); try { await login('admin', { email, password }); navigate('/admin'); } catch (e) { setError(e.message); } }; return <main className="auth-page"><section className="auth-card admin-card"><p className="eyebrow">Operations</p><h1>Admin sign in</h1><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className="error">{error}</p>}<button>Enter control room</button></form></section></main>; }
function DiscountManager() {
  const empty = { discountName: '', discountType: 'percentage', discountValue: '', startDate: '', endDate: '', isActive: true };
  const [discounts, setDiscounts] = useState([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState(null); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const load = () => api.discounts().then((result) => setDiscounts(result.discounts || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const dateValue = (value) => value ? new Date(value).toISOString().slice(0, 16) : '';
  const edit = (discount) => { setEditing(discount.discount_id); setForm({ discountName: discount.discount_name, discountType: discount.discount_type, discountValue: discount.discount_value, startDate: dateValue(discount.start_date), endDate: dateValue(discount.end_date), isActive: discount.is_active }); setMessage(''); setError(''); };
  const submit = async (event) => { event.preventDefault(); setError(''); setMessage(''); try { const body = { ...form, discountValue: Number(form.discountValue), isActive: Boolean(form.isActive) }; const result = editing ? await api.updateDiscount(editing, body) : await api.createDiscount(body); setMessage(result.message); setForm(empty); setEditing(null); await load(); } catch (e) { setError(e.message); } };
  const remove = async (id) => { setError(''); try { const result = await api.deleteDiscount(id); setMessage(result.message); if (editing === id) { setEditing(null); setForm(empty); } await load(); } catch (e) { setError(e.message); } };
  return <section className="dashboard-panel discount-manager"><div className="section-heading"><div><p className="eyebrow">Pricing control</p><h2>{editing ? 'Edit discount' : 'Create discount'}</h2></div>{editing && <button type="button" className="small-button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div><form className="compact-form" onSubmit={submit}><input required placeholder="Discount name" value={form.discountName} onChange={(e) => setForm({ ...form, discountName: e.target.value })} /><div className="form-grid"><label>Type<select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}><option value="percentage">Percentage</option><option value="fixed_amount">Fixed amount</option></select></label><label>Value<input required type="number" min="0.01" step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} /></label></div><div className="form-grid"><label>Starts<input required type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label><label>Ends<input required type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label></div>{editing && <label className="check-label"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active discount</label>}<button>{editing ? 'Save discount' : 'Create discount'}</button></form>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success">{message}</p>}<div className="discount-list">{discounts.length ? discounts.map((discount) => <article className="discount-row" key={discount.discount_id}><div><strong>{discount.discount_name}</strong><p>{discount.discount_type === 'percentage' ? `${discount.discount_value}% off` : `${money(discount.discount_value)} off`} · {discount.is_active ? 'Active' : 'Inactive'}</p></div><div className="form-actions"><button className="small-button" onClick={() => edit(discount)}>Edit</button><button className="small-button danger-button" onClick={() => remove(discount.discount_id)}>Delete</button></div></article>) : <p className="muted">No discounts created yet.</p>}</div></section>;
}
function Admin() { return <Guard role="admin"><main><section className="dashboard-hero admin-hero"><p className="eyebrow">Admin dashboard</p><h1>Marketplace operations.</h1><p className="muted">Create and maintain the discounts sellers can apply to their products.</p></section><div className="dashboard-grid"><DiscountManager /><section className="dashboard-panel"><p className="eyebrow">System status</p><h2>Authentication active</h2><p className="muted">Discount changes are protected by the admin session and appear in product prices when active.</p><span className="status-pill green">Connected</span></section></div></main></Guard>; }

function CompactAddressBook() {
  const [addresses, setAddresses] = useState([]); const [open, setOpen] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ label: 'Home', street: '', city: '', postalCode: '', country: '', isCurrent: true });
  const load = () => api.addresses().then((result) => setAddresses(result.addresses || [])).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const submit = async (event) => { event.preventDefault(); try { await api.addAddress({ ...form, isCurrent: Boolean(form.isCurrent) }); setForm({ label: 'Home', street: '', city: '', postalCode: '', country: '', isCurrent: false }); setOpen(false); load(); } catch (e) { setError(e.message); } };
  const current = addresses.find((address) => address.is_current);
  return <section className="dashboard-panel address-compact"><div className="section-heading"><div><p className="eyebrow">Shipping</p><h2>Delivery address</h2></div><button className="small-button" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Manage'}</button></div>{current ? <div className="current-address"><strong>{current.label}</strong><span>{current.street}, {current.city}, {current.postal_code}, {current.country}</span></div> : <p className="muted">No current shipping address selected.</p>}{error && <p className="error">{error}</p>}{open && <><form className="compact-form" onSubmit={submit}><input placeholder="Nickname, e.g. Home" required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /><input placeholder="Street address" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /><div className="form-grid"><input placeholder="City" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /><input placeholder="Postal code" required value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} /></div><input placeholder="Country" required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /><label className="check-label"><input type="checkbox" checked={form.isCurrent} onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })} /> Use as current address</label><button>Add address</button></form><div className="address-list">{addresses.map((address) => <article className={`address-item ${address.is_current ? 'selected' : ''}`} key={address.address_id}><div><strong>{address.label}</strong><p>{address.street}, {address.city}, {address.postal_code}, {address.country}</p></div><div className="form-actions">{!address.is_current && <button className="small-button" onClick={() => api.setCurrentAddress(address.address_id).then(load).catch((e) => setError(e.message))}>Use this</button>}<button className="small-button danger-button" onClick={() => api.deleteAddress(address.address_id).then(load).catch((e) => setError(e.message))}>Delete</button></div></article>)}</div></>}</section>;
}

function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.orders()
      .then((result) => setOrders(result.orders || []))
      .catch((e) => setError(e.message));
  }, []);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  };

  return (
    <section className="dashboard-panel order-history">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your purchases</p>
          <h2>Previously ordered</h2>
        </div>
        <button className="small-button" onClick={() => setOpen(!open)}>
          {open ? 'Hide history' : `View history (${orders.length})`}
        </button>
      </div>

      {error ? (
        <p className="error">{error}</p>
      ) : !open ? (
        <p className="muted">Your completed and active purchases will appear here.</p>
      ) : !orders.length ? (
        <p className="muted">No orders yet.</p>
      ) : (
        <div className="order-list">
          {orders.map((order) => {
            const items = Array.isArray(order.items) ? order.items : [];
            const total = Number(order.total_amount ?? order.totalAmount ?? order.amount ?? 0);
            const paymentMethod = order.payment_method ?? order.paymentMethod ?? 'Cash on delivery';
            const paymentStatus = order.payment_status ?? order.paymentStatus ?? 'pending';
            const receiverName = order.receiver_name ?? order.receiverName ?? 'Receiver';
            const receiverPhone = order.receiver_phone_number ?? order.receiverPhoneNumber ?? '—';

            return (
              <article className="order-card" key={order.order_id ?? order.orderId}>
                <div className="order-card-heading">
                  <strong>Order #{order.order_id ?? order.orderId}</strong>
                  <span className="status-pill">{order.status}</span>
                  <small>{formatDate(order.created_at ?? order.createdAt)}</small>
                </div>

                <div className="order-summary-row">
                  <span>{receiverName}</span>
                  <span>{receiverPhone}</span>
                </div>

                <div className="order-meta-list">
                  <span>Payment: {paymentMethod}</span>
                  <span>Status: {paymentStatus}</span>
                  <span>Total: {money(total)}</span>
                </div>

                {items.length ? (
                  <div className="ordered-items">
                    {items.map((item, index) => {
                      const itemName = item.productName ?? item.product_name ?? 'Product';
                      const itemQuantity = Number(item.quantity ?? 1);
                      const itemPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
                      const image = item.imageUrl ?? item.image_url ?? item.image ?? '';

                      return (
                        <div className="ordered-item" key={`${order.order_id ?? order.orderId}-${item.productId ?? item.product_id ?? index}`}>
                          {image ? <img src={imageUrl(image)} alt="" /> : <div className="image-placeholder small"><span>Item</span></div>}
                          <div>
                            <strong>{itemName}</strong>
                            <span>Qty {itemQuantity} · {money(itemPrice)} each</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">No item details are attached to this order in the current backend response.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function BuyerDashboard() { return <Guard role="buyer"><main><section className="dashboard-hero"><p className="eyebrow">Buyer dashboard</p><h1>Your marketplace, organized.</h1><p className="muted">Keep your delivery details and purchases close at hand.</p></section><div className="buyer-dashboard-stack"><OrderHistory /><CompactAddressBook /></div></main></Guard>; }

function ProductEditor({ product, onSaved, onCancel }) {
  const editing = Boolean(product); const [form, setForm] = useState(product ? { name: product.product_name, description: product.product_description, price: product.price, stock: 0 } : { name: '', description: '', price: '', stock: 0 }); const [files, setFiles] = useState([]); const [categories, setCategories] = useState([]); const [selectedCategories, setSelectedCategories] = useState((product?.categories || []).map((category) => String(category.categoryId || category.category_id))); const [categoryLoading, setCategoryLoading] = useState(true); const [categoryError, setCategoryError] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { api.categories().then((result) => setCategories(result.categories || [])).catch((e) => setCategoryError(e.message)).finally(() => setCategoryLoading(false)); }, []);
  const toggleCategory = (categoryId) => setSelectedCategories((current) => current.includes(String(categoryId)) ? current.filter((id) => id !== String(categoryId)) : [...current, String(categoryId)]);
  const syncCategories = async (productId) => { const currentCategories = (product?.categories || []).map((category) => String(category.categoryId || category.category_id)); const additions = selectedCategories.filter((categoryId) => !currentCategories.includes(categoryId)); const removals = currentCategories.filter((categoryId) => !selectedCategories.includes(categoryId)); await Promise.all([...additions.map((categoryId) => api.addProductCategory(productId, categoryId)), ...removals.map((categoryId) => api.removeProductCategory(productId, categoryId))]); };
  const submit = async (event) => { event.preventDefault(); setError(''); setMessage(''); const data = new FormData(); data.append('name', form.name); data.append('description', form.description); data.append('price', form.price); data.append(editing ? 'additionalStock' : 'stock', form.stock); files.forEach((file) => data.append('images', file)); try { const result = editing ? await api.updateProduct(product.product_id, data) : await api.createProductMultipart(data); const productId = editing ? product.product_id : result.product.product_id; await syncCategories(productId); setMessage(`${result.message} Categories updated.`); onSaved(); } catch (e) { setError(e.message); } };
  return <form className="dashboard-panel product-editor" onSubmit={submit}><div className="section-heading"><div><p className="eyebrow">{editing ? 'Edit product' : 'New listing'}</p><h2>{editing ? product.product_name : 'Create product'}</h2></div>{editing && <button type="button" className="small-button" onClick={onCancel}>Close</button>}</div><input placeholder="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><textarea placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><div className="form-grid"><input type="number" min="0.01" step="0.01" placeholder="Price" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /><input type="number" min="0" step="1" placeholder={editing ? 'Add stock' : 'Initial stock'} required value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div><fieldset className="category-picker" disabled={categoryLoading || Boolean(categoryError)}><legend>Categories</legend>{categoryLoading ? <p className="muted">Loading categories...</p> : categoryError ? <p className="error">Categories unavailable: {categoryError}</p> : categories.length ? <div className="category-options">{categories.map((category) => <label key={category.category_id}><input type="checkbox" checked={selectedCategories.includes(String(category.category_id))} onChange={() => toggleCategory(category.category_id)} /> {category.category_name}</label>)}</div> : <p className="muted">No categories are available yet.</p>}</fieldset><label className="upload-label">{editing ? 'Add images to this product' : 'Product images'}<input type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} /></label>{editing && <div className="edit-images">{(product.images || []).map((image) => <div key={image.imageId || image.image_id}><img src={imageUrl(image.imageUrl || image.image_url)} alt="" /><button type="button" className="small-button" onClick={() => api.primaryImage(product.product_id, image.imageId || image.image_id).then(onSaved).catch((e) => setError(e.message))}>{image.isPrimary || image.is_primary ? 'Primary' : 'Set primary'}</button><button type="button" className="small-button danger-button" onClick={() => api.deleteImage(image.imageId || image.image_id).then(onSaved).catch((e) => setError(e.message))}>Delete</button></div>)}</div>}{error && <p className="error">{error}</p>}{message && <p className="success">{message}</p>}<button>{editing ? 'Save product changes' : 'Create product'}</button></form>;
}

function SellerDashboard() {
  const [products, setProducts] = useState([]); const [discounts, setDiscounts] = useState([]); const [editing, setEditing] = useState(null); const [creating, setCreating] = useState(false); const [error, setError] = useState(''); const [discountError, setDiscountError] = useState(''); const [message, setMessage] = useState('');
  const load = () => Promise.all([api.sellerProducts().then(setProducts), api.discounts().then((result) => setDiscounts(result.discounts || []))]).catch((e) => setError(e.message)); useEffect(() => { load(); }, []);
  const assign = async (productId, discountId) => { setDiscountError(''); setMessage(''); try { if (discountId) { const result = await api.assignProductDiscount(productId, Number(discountId)); setMessage(result.message); } else { const result = await api.removeProductDiscount(productId); setMessage(result.message); } await load(); } catch (e) { setDiscountError(e.message); } };
  return <main><section className="dashboard-hero seller-hero"><p className="eyebrow">Seller dashboard</p><h1>Build a storefront people trust.</h1><p className="muted">Manage each product as one listing, with one image gallery and its promotional pricing.</p><button className="button" onClick={() => { setCreating(true); setEditing(null); }}>Create product</button></section>{error && <ErrorMessage message={error} />}{(creating || editing) && <ProductEditor product={editing} onCancel={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}<section className="seller-catalog"><div className="section-heading"><div><p className="eyebrow">Your catalog</p><h2>Products</h2></div><span>{products.length} listings</span></div>{discountError && <p className="error" role="alert">{discountError}</p>}{message && <p className="success">{message}</p>}{products.length ? products.map((product) => <article className="seller-listing" key={product.product_id}><ProductImage product={product} /><div><h3>{product.product_name}</h3><p>{money(effectivePrice(product))}{effectivePrice(product) < Number(product.price) && ` (was ${money(product.price)})`} · {product.available_stock} available · {(product.images || []).length} images</p><label className="discount-select">Promotion<select value={product.discount_id || ''} onChange={(e) => assign(product.product_id, e.target.value)}><option value="">No discount</option>{discounts.map((discount) => <option key={discount.discount_id} value={discount.discount_id}>{discount.discount_name} ({discount.discount_type === 'percentage' ? `${discount.discount_value}%` : money(discount.discount_value)})</option>)}</select></label></div><button className="small-button" onClick={() => { setEditing(product); setCreating(false); }}>Edit product</button></article>) : <p className="state">No products yet.</p>}</section></main>;
}

function App() { return <><Header /><Routes><Route path="/" element={<Home />} /><Route path="/products/:id" element={<Product />} /><Route path="/login" element={<Login />} /><Route path="/admin/login" element={<AdminLogin />} /><Route path="/register/buyer" element={<Register role="buyer" />} /><Route path="/register/seller" element={<Register role="seller" />} /><Route path="/cart" element={<Guard role="buyer"><Cart /></Guard>} /><Route path="/buyer" element={<BuyerDashboard />} /><Route path="/seller" element={<Guard role="seller"><SellerDashboard /></Guard>} /><Route path="/admin" element={<Admin />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>; }

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><Provider><App /></Provider></BrowserRouter></StrictMode>);
