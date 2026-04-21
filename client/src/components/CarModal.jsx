import React, { useState, useEffect } from 'react';
import './CarModal.css';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    maximumFractionDigits: 0,
  }).format(price);

const SPEC_LABELS = {
  year: 'Year',
  make: 'Make',
  model: 'Model',
  price: 'Price',
  parish: 'Parish',
  bodyType: 'Body Type',
  transmission: 'Transmission',
  driverSide: 'Driver Side',
  mileage: 'Mileage',
  contactNumber: 'Contact',
  user: 'Source',
  date: 'Date Listed',
};

export default function CarModal({ car, onClose }) {
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const imgs = car.imgs ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>

        {imgs.length > 0 ? (
          <div className="modal__gallery">
            <div className="modal__main-img-wrap">
              <img
                className="modal__main-img"
                src={imgs[activeImg]}
                alt={`${car.year} ${car.make} ${car.model}`}
              />
              {imgs.length > 1 && (
                <>
                  <button
                    className="modal__nav modal__nav--prev"
                    onClick={() => setActiveImg((i) => (i - 1 + imgs.length) % imgs.length)}
                  >‹</button>
                  <button
                    className="modal__nav modal__nav--next"
                    onClick={() => setActiveImg((i) => (i + 1) % imgs.length)}
                  >›</button>
                  <span className="modal__img-counter">{activeImg + 1} / {imgs.length}</span>
                </>
              )}
            </div>
            {imgs.length > 1 && (
              <div className="modal__thumbs">
                {imgs.map((src, i) => (
                  <img
                    key={i}
                    className={`modal__thumb${i === activeImg ? ' modal__thumb--active' : ''}`}
                    src={src}
                    alt=""
                    onClick={() => setActiveImg(i)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="modal__no-image">🚗</div>
        )}

        <div className="modal__content">
          <div className="modal__header">
            <h2 className="modal__title">{car.year} {car.make} {car.model}</h2>
            <p className="modal__price">{formatPrice(car.price)}</p>
          </div>

          <dl className="modal__specs">
            {Object.entries(SPEC_LABELS).map(([key, label]) => {
              const val = car[key];
              if (!val) return null;
              return (
                <div key={key} className="modal__spec-row">
                  <dt>{label}</dt>
                  <dd>{key === 'price' ? formatPrice(val) : val}</dd>
                </div>
              );
            })}
          </dl>

          {car.description && (
            <div className="modal__description">
              <h4>Description</h4>
              <p>{car.description}</p>
            </div>
          )}

          <a
            className="modal__link"
            href={car.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Original Listing ↗
          </a>
        </div>
      </div>
    </div>
  );
}
