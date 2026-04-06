import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { LoadState, money, useLoad, useShop } from './App';

function ProductCard({ product }) {
  const { add, busy, favorites, favorite, favoritesLoading, favoritesError } = useShop();
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/products/${product.id}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </Link>
        <button
          className={`favorite ${favorites.includes(product.id) ? 'selected' : ''}`}
          aria-label={`علاقه‌مندی: ${product.name}`}
          aria-pressed={favorites.includes(product.id)}
          disabled={busy || favoritesLoading || !!favoritesError}
          onClick={() => favorite(product.id)}
        >
          ♡
        </button>
        {(!product.active || !product.stock) && <span className="badge stock-badge">ناموجود</span>}
      </div>
      <div className="product-body">
        <span className="eyebrow">{product.category}</span>
        <h3>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <p>{product.description}</p>
        <div className="product-bottom">
          <strong>{money(product.priceCents)}</strong>
          <button
            disabled={busy || !product.stock || !product.active}
            onClick={() => add(product)}
            aria-label={`افزودن ${product.name} به سبد`}
          >
            افزودن +
          </button>
        </div>
      </div>
    </article>
  );
}
export function Catalog() {
  const { revision } = useShop();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'featured';
  const pageText = params.get('page') || '0';
  const page = /^\d+$/.test(pageText) && Number(pageText) <= 100000 ? Number(pageText) : 0;
  const request = new URLSearchParams({
    q: query,
    category: category === 'all' ? '' : category,
    sort,
    page: String(page),
    size: '12',
  });
  const resource = useLoad(`/catalog?${request}`, revision);
  const categories = resource.data?.categories || [];
  const visible = resource.data?.items || [];
  function filter(key, value) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('page');
        if (!value || value === 'all' || value === 'featured') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }
  function goToPage(nextPage) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (nextPage === 0) next.delete('page');
      else next.set('page', String(nextPage));
      return next;
    });
    document.getElementById('catalog')?.scrollIntoView({ block: 'start' });
  }
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">تازه، ساده، خوش‌مزه</span>
          <h1>
            کمی تازگی،
            <br />
            <em>هر روزِ زندگی.</em>
          </h1>
          <p>
            میوه و سبزیجات منتخب را با خیال آسوده انتخاب کنید. سبدتان را بسازید و سفارش را تا درِ
            خانه پیگیری کنید.
          </p>
          <a className="button" href="#catalog">
            کشف محصولات <span>↙</span>
          </a>
          <div className="hero-caption">
            <span className="tiny-leaf">❧</span> انتخاب فصل، برای سفرهٔ شما
          </div>
        </div>
        <div className="hero-visual">
          <img src="/images/banner-01.jpg" alt="محصولات تازهٔ باغ" fetchPriority="high" />
          <div className="hero-stamp">
            از باغ
            <br />
            <strong>تا خانه</strong>
            <span>FRESH EVERY DAY</span>
          </div>
        </div>
      </section>
      <div className="benefits shell">
        <div>
          <span>01</span>
          <strong>انتخاب با دقت</strong>
          <p>محصولات تازه و منتخب فصل</p>
        </div>
        <div>
          <span>02</span>
          <strong>خرید آسان</strong>
          <p>قیمت روشن، سبد خرید ساده</p>
        </div>
        <div>
          <span>03</span>
          <strong>پیگیری سفارش</strong>
          <p>از ثبت سفارش تا تحویل</p>
        </div>
      </div>
      <section className="shell catalog" id="catalog">
        <div className="section-heading">
          <div>
            <span className="eyebrow">انتخاب امروز</span>
            <h2>تازگی را به خانه ببرید</h2>
          </div>
          <p>
            {resource.loading
              ? 'در حال جستجو…'
              : `${resource.data?.totalElements || 0} محصول برای انتخاب شما`}
          </p>
        </div>
        <div className="toolbar">
          <div className="tabs" aria-label="دسته‌بندی">
            <button
              className={category === 'all' ? 'active' : ''}
              aria-pressed={category === 'all'}
              onClick={() => filter('category', 'all')}
            >
              همهٔ محصولات
            </button>
            {categories.map((c) => (
              <button
                key={c}
                aria-pressed={category === c}
                className={category === c ? 'active' : ''}
                onClick={() => filter('category', c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="filters">
            <label className="search">
              <span className="sr-only">جستجوی محصولات</span>
              <input
                value={query}
                onChange={(e) => filter('q', e.target.value)}
                maxLength={120}
                placeholder="جستجوی محصول…"
                type="search"
              />
            </label>
            <label>
              <span className="sr-only">مرتب‌سازی</span>
              <select value={sort} onChange={(e) => filter('sort', e.target.value)}>
                <option value="featured">پیشنهاد ما</option>
                <option value="low">ارزان‌ترین</option>
                <option value="high">گران‌ترین</option>
                <option value="name">نام محصول</option>
              </select>
            </label>
          </div>
        </div>
        <LoadState resource={resource}>
          {visible.length ? (
            <div className="product-grid">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>محصولی پیدا نشد</h3>
              <p>عبارت دیگری جستجو کنید یا دسته‌بندی را تغییر دهید.</p>
              <button
                onClick={() => {
                  setParams({});
                }}
              >
                نمایش همه
              </button>
            </div>
          )}
        </LoadState>
        {resource.data?.totalPages > 1 && (
          <nav className="pagination" aria-label="صفحه‌بندی محصولات">
            <button
              className="outline"
              disabled={resource.loading || page === 0}
              onClick={() => goToPage(page - 1)}
            >
              صفحهٔ قبلی
            </button>
            <span role="status">
              صفحهٔ {page + 1} از {resource.data.totalPages}
            </span>
            <button
              className="outline"
              disabled={resource.loading || page + 1 >= resource.data.totalPages}
              onClick={() => goToPage(page + 1)}
            >
              صفحهٔ بعدی
            </button>
          </nav>
        )}
      </section>
      <section className="shell seasonal">
        <span className="eyebrow">یک سبد، هزار طعم</span>
        <h2>
          برای آشپزی امروز،
          <br />
          از همین‌جا شروع کنید.
        </h2>
        <p>قیمت کالا و هزینهٔ ارسال را پیش از ثبت سفارش ببینید.</p>
        <Link className="button light" to="/cart">
          مشاهدهٔ سبد خرید ←
        </Link>
      </section>
    </>
  );
}
export function ProductDetail() {
  const { id } = useParams();
  const { revision, add, busy, favorites, favorite, favoritesLoading, favoritesError } = useShop();
  const resource = useLoad(`/products/${id}`, revision);
  const p = resource.data;
  return (
    <section className="shell page">
      <Link className="back" to="/">
        ← همهٔ محصولات
      </Link>
      <LoadState resource={resource}>
        {p && (
          <div className="detail">
            <img src={p.image} alt={p.name} />
            <div>
              <span className="eyebrow">{p.category}</span>
              <h1>{p.name}</h1>
              <p>{p.description}</p>
              <strong className="detail-price">{money(p.priceCents)}</strong>
              <p>{p.stock > 0 ? `${p.stock} عدد موجود` : 'فعلاً ناموجود'}</p>
              <div className="actions">
                <button disabled={busy || !p.stock} onClick={() => add(p)}>
                  افزودن به سبد
                </button>
                <button
                  className="outline"
                  aria-pressed={favorites.includes(p.id)}
                  disabled={busy || favoritesLoading || !!favoritesError}
                  onClick={() => favorite(p.id)}
                >
                  {favorites.includes(p.id) ? 'حذف از علاقه‌مندی' : 'ذخیره در علاقه‌مندی'}
                </button>
              </div>
              <p className="muted">پرداخت هنگام تحویل. هزینهٔ ارسال در سبد محاسبه می‌شود.</p>
            </div>
          </div>
        )}
      </LoadState>
    </section>
  );
}
export function Wishlist() {
  const user = useSelector((s) => s.session.user);
  const {
    favorites,
    revision,
    favoriteProducts,
    favoritesLoading,
    favoritesError,
    retryFavorites,
  return (
    <section className="shell page">
      <span className="eyebrow">انتخاب‌های شما</span>
      <h1>علاقه‌مندی‌ها</h1>
      <p className="muted">در همین مرورگر ذخیره می‌شود.</p>
      <LoadState resource={resource}>
        {products.length ? (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <h2>هنوز محصولی ذخیره نکرده‌اید</h2>
            <Link className="button" to="/">
              دیدن محصولات
            </Link>
          </div>
        )}
      </LoadState>
    </section>
  );
}
