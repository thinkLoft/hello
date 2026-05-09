import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { fetchCarBySlug, revealContact } from '../services/api';
import { scraperName } from '../utils/scraperNames';
import DealRatingBadge from '../components/DealRatingBadge';
import { useAuth } from '../context/AuthContext';
import './CarDetailPage.css';

const formatPrice = (price) =>
  (!price || price === 0)
    ? 'Call for Pricing'
    : new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(price);

const formatDate = (val) => {
  if (!val) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const SPEC_LABELS = {
  year: 'Year',
  make: 'Make',
  model: 'Model',
  parish: 'Parish',
  bodyType: 'Body Type',
  transmission: 'Transmission',
  driverSide: 'Driver Side',
  mileage: 'Mileage',
  user: 'Source',
  date: 'Date Listed',
};

const BASE_URL = 'https://autos876-dc045b5182e0.herokuapp.com';

export default function CarDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [car, setCar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [revealedNumber, setRevealedNumber] = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState(null);

  useEffect(() => {
    fetchCarBySlug(slug)
      .then(setCar)
      .catch((err) => {
        if (err.message.includes('404')) setNotFound(true);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleReveal = async () => {
    setRevealLoading(true);
    setRevealError(null);
    try {
      const { contactNumber } = await revealContact(car._id);
      setRevealedNumber(contactNumber);
    } catch (err) {
      setRevealError(err.message.includes('429') ? 'Too many requests — try again shortly' : 'Could not load contact info');
    } finally {
      setRevealLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="car-detail car-detail--loading">
        <div className="car-detail__spinner">Loading…</div>
      </div>
    );
  }

  if (notFound || !car) {
    return (
      <div className="car-detail car-detail--404">
        <p>Listing not found or has been removed.</p>
        <Link to="/" className="car-detail__back">← Back to listings</Link>
      </div>
    );
  }

  const imgs = car.imgs ?? [];
  const ogTitle = `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.trim();
  const ogDesc = [formatPrice(car.price), car.parish, car.transmission].filter(Boolean).join(' · ');
  const ogImage = imgs[0] ?? '';
  const ogUrl = `${BASE_URL}/cars/${car.slug}`;

  return (
    <div className="car-detail">
      <Helmet>
        <title>{ogTitle} — Beego</title>
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={ogUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      <div className="car-detail__nav">
        <Link to="/" className="car-detail__back">← Back to listings</Link>
      </div>

      <div className="car-detail__body">
        {imgs.length > 0 ? (
          <div className="car-detail__gallery">
            <div className="car-detail__main-img-wrap">
              <img
                className="car-detail__main-img"
                src={imgs[activeImg]}
                alt={ogTitle}
              />
              {imgs.length > 1 && (
                <>
                  <button
                    className="car-detail__nav-btn car-detail__nav-btn--prev"
                    onClick={() => setActiveImg((i) => (i - 1 + imgs.length) % imgs.length)}
                  >‹</button>
                  <button
                    className="car-detail__nav-btn car-detail__nav-btn--next"
                    onClick={() => setActiveImg((i) => (i + 1) % imgs.length)}
                  >›</button>
                  <span className="car-detail__img-counter">{activeImg + 1} / {imgs.length}</span>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="car-detail__thumbs">
                {imgs.map((src, i) => (
                  <img
                    key={i}
                    className={`car-detail__thumb${i === activeImg ? ' car-detail__thumb--active' : ''}`}
                    src={src}
                    alt=""
                    onClick={() => setActiveImg(i)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="car-detail__no-image">🚗</div>
        )}

        <div className="car-detail__info">
          <div className="car-detail__header">
            <h1 className="car-detail__title">{ogTitle}</h1>
            <div className="car-detail__price-row">
              <p className="car-detail__price">{formatPrice(car.price)}</p>
              {car.score != null && (isAdmin || car.comparableCount >= 10) && (
                <DealRatingBadge score={car.score} size="md" showScore={isAdmin} />
              )}
            </div>
          </div>

          <dl className="car-detail__specs">
            {Object.entries(SPEC_LABELS).map(([key, label]) => {
              const val = car[key];
              if (!val) return null;
              let display = val;
              if (key === 'date') display = formatDate(val);
              else if (key === 'user') display = scraperName(val);
              return (
                <div key={key} className="car-detail__spec-row">
                  <dt>{label}</dt>
                  <dd>{display}</dd>
                </div>
              );
            })}
          </dl>

          {car.description && (
            <div className="car-detail__description">
              <h3>Description</h3>
              <p>{car.description}</p>
            </div>
          )}

          <div className="car-detail__actions">
            {(car.hasContact || car.contactNumber) && !revealedNumber && (
              <button
                className="car-detail__btn car-detail__btn--reveal"
                onClick={handleReveal}
                disabled={revealLoading}
              >
                {revealLoading ? 'Loading…' : '📞 Show Contact Number'}
              </button>
            )}
            {revealError && <p className="car-detail__reveal-error">{revealError}</p>}
            {revealedNumber && (
              <>
                <p className="car-detail__revealed-number">📞 {revealedNumber}</p>
                <a className="car-detail__btn car-detail__btn--call" href={`tel:+${revealedNumber}`}>
                  Call Seller
                </a>
                <a
                  className="car-detail__btn car-detail__btn--whatsapp"
                  href={`https://wa.me/${revealedNumber}?text=${encodeURIComponent(`Hi, I'm interested in the ${ogTitle}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 WhatsApp
                </a>
              </>
            )}
            {car.url && (
              <a
                className="car-detail__source-link"
                href={car.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on {scraperName(car.user)} ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
