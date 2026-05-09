import React, { useState } from 'react';
import './CarCard.css';
import { useAuth } from '../context/AuthContext';
import { scraperName } from '../utils/scraperNames';
import DealRatingBadge from './DealRatingBadge';
import { revealContact } from '../services/api';

const formatPrice = (price) =>
  (!price || price === 0)
    ? 'Call for Pricing'
    : new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD', maximumFractionDigits: 0 }).format(price);

export default function CarCard({ car, onClick, sold }) {
  const [imgError, setImgError] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const hasImage = !imgError && car.imgs?.[0];

  const handleWhatsApp = async (e) => {
    e.stopPropagation();
    setWaLoading(true);
    try {
      const { contactNumber } = await revealContact(car._id);
      const num = contactNumber.replace(/\D/g, '');
      const text = encodeURIComponent(`Hi, I'm interested in your ${car.year} ${car.make} ${car.model} listed on Beego.`);
      window.open(`https://wa.me/${num}?text=${text}`, '_blank');
    } catch {
      // fall through — user can open the modal to contact
    } finally {
      setWaLoading(false);
    }
  };

  return (
    <article className={`car-card${sold ? ' car-card--sold' : ''}`} onClick={() => onClick(car)}>
      <div className="car-card__image-wrap">
        {hasImage ? (
          <img
            className="car-card__image"
            src={car.imgs[0]}
            alt={`${car.year} ${car.make} ${car.model}`}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="car-card__no-image">
            <span>🚗</span>
            <span>No image</span>
          </div>
        )}
        {car.imgs?.length > 1 && (
          <span className="car-card__img-count">+{car.imgs.length - 1} photos</span>
        )}
        <span className="car-card__source">{scraperName(car.user)}</span>
        {car.score != null && (isAdmin || car.comparableCount >= 10) && (
          <span className="car-card__deal-badge">
            <DealRatingBadge score={car.score} size="sm" showScore={isAdmin} />
          </span>
        )}
        {sold && (
          <div className="car-card__sold-overlay">
            <span>SOLD</span>
          </div>
        )}
      </div>

      <div className="car-card__body">
        <h3 className="car-card__title">
          {car.year} {car.make} {car.model}
        </h3>
        <p className="car-card__price">{formatPrice(car.price)}</p>
        {car.parish && (
          <p className="car-card__location">
            <span className="car-card__location-icon">📍</span>
            {car.parish}
          </p>
        )}
        <div className="car-card__tags">
          {car.bodyType && <span className="tag">{car.bodyType}</span>}
          {car.transmission && <span className="tag tag--alt">{car.transmission}</span>}
          {car.driverSide === 'Right Hand Drive' && <span className="tag tag--rhd">RHD</span>}
        </div>
        {(car.hasContact || car.contactNumber) && (
          <div className="car-card__actions">
            <button
              className="car-card__wa-btn"
              onClick={handleWhatsApp}
              disabled={waLoading}
            >
              {waLoading ? '…' : '💬 WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
