import React, { useState, useEffect } from 'react';
import './CarModal.css';
import { useAuth } from '../context/AuthContext';
import { updateListing, rescoreListing, hideListing, revealContact } from '../services/api';
import { scraperName } from '../utils/scraperNames';
import DealRatingBadge from './DealRatingBadge';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-JM', {
    style: 'currency',
    currency: 'JMD',
    maximumFractionDigits: 0,
  }).format(price);

const formatDate = (val) => {
  if (!val) return val;
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const BREAKDOWN_LABELS = {
  price: 'Price vs Market',
  completeness: 'Completeness',
  mileage: 'Mileage Sanity',
  source: 'Source Credibility',
  images: 'Image Count',
};

function scoreColor(score) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

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
  user: 'Source',
  date: 'Date Listed',
};

const EDIT_FIELDS = [
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'year', label: 'Year', type: 'number' },
  { key: 'make', label: 'Make', type: 'text' },
  { key: 'model', label: 'Model', type: 'text' },
  { key: 'mileage', label: 'Mileage', type: 'text' },
  { key: 'parish', label: 'Parish', type: 'text' },
  { key: 'bodyType', label: 'Body Type', type: 'text' },
  { key: 'transmission', label: 'Transmission', type: 'select', options: ['', 'Automatic', 'Manual'] },
  { key: 'driverSide', label: 'Driver Side', type: 'select', options: ['', 'Right Hand Drive', 'Left Hand Drive'] },
  { key: 'contactNumber', label: 'Contact Number', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'adminNotes', label: 'Admin Notes (private)', type: 'textarea' },
];

export default function CarModal({ car, onClose, onSold, onUpdate, onHide }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeImg, setActiveImg] = useState(0);
  const [soldConfirm, setSoldConfirm] = useState(false);
  const [soldLoading, setSoldLoading] = useState(false);
  const [isSold, setIsSold] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [rescoring, setRescoring] = useState(false);

  const [hideLoading, setHideLoading] = useState(false);

  const [revealedNumber, setRevealedNumber] = useState(null);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState(null);

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

  const enterEdit = () => {
    setEditForm({
      price: car.price ?? '',
      year: car.year ?? '',
      make: car.make ?? '',
      model: car.model ?? '',
      mileage: car.mileage ?? '',
      parish: car.parish ?? '',
      bodyType: car.bodyType ?? '',
      transmission: car.transmission ?? '',
      driverSide: car.driverSide ?? '',
      contactNumber: revealedNumber ?? '',
      description: car.description ?? '',
      adminNotes: car.adminNotes ?? '',
    });
    setEditError(null);
    setEditMode(true);
  };

  const handleEditField = (key) => (e) =>
    setEditForm((f) => ({ ...f, [key]: e.target.value }));

  const handleEditSave = async () => {
    setEditSaving(true);
    setEditError(null);
    try {
      const payload = { ...editForm };
      if (payload.price !== '') payload.price = Number(payload.price);
      if (payload.year !== '') payload.year = Number(payload.year);
      await updateListing(car._id, payload);
      onUpdate?.({ _id: car._id, ...payload });
      setEditMode(false);

      // Re-score in background after saving
      setRescoring(true);
      try {
        const scoreResult = await rescoreListing(car._id);
        onUpdate?.({ _id: car._id, ...payload, ...scoreResult });
      } catch {
        // Non-critical — silently ignore rescore failures
      } finally {
        setRescoring(false);
      }
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleSoldClick = async () => {
    if (!soldConfirm) { setSoldConfirm(true); return; }
    setSoldLoading(true);
    try {
      await onSold(car);
      setIsSold(true);
      setTimeout(onClose, 1800);
    } catch {
      setSoldLoading(false);
    }
  };

  const handleHideClick = async () => {
    setHideLoading(true);
    try {
      await onHide?.(car);
    } catch {
      setHideLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { if (editMode) setEditMode(false); else onClose(); }
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, editMode]);

  const imgs = car.imgs ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Fixed close button (stays in viewport while scrolling) */}
        <button className="modal__close" onClick={onClose} aria-label="Close">✕</button>
        {/* Inner close button (top-right of modal box) */}
        <button className="modal__close-inner" onClick={onClose} aria-label="Close">✕</button>

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
            <div className="modal__price-row">
              <p className="modal__price">{formatPrice(car.price)}</p>
              {car.score != null && isAdmin && <DealRatingBadge score={car.score} size="md" showScore />}
            </div>
          </div>

          <dl className="modal__specs">
            {Object.entries(SPEC_LABELS).map(([key, label]) => {
              const val = car[key];
              if (!val) return null;
              let display = val;
              if (key === 'price') display = formatPrice(val);
              else if (key === 'date') display = formatDate(val);
              else if (key === 'user') display = scraperName(val);
              return (
                <div key={key} className="modal__spec-row">
                  <dt>{label}</dt>
                  <dd>{display}</dd>
                </div>
              );
            })}
          </dl>

          {isAdmin && car.score != null && (
            <div className="modal__admin-score">
              <div className="modal__admin-score-header">
                <h4 className="modal__admin-score-heading">Quality Score</h4>
                {rescoring && <span className="modal__rescoring">Rescoring…</span>}
              </div>
              <div className="modal__admin-score-body">
                <span className={`modal__score-badge modal__score-badge--${scoreColor(car.score)}`}>
                  {car.score} / 100
                </span>
                {car.anomalyFlags?.length > 0 && (
                  <div className="modal__flags">
                    {car.anomalyFlags.map((flag) => (
                      <span key={flag} className="modal__flag">{flag}</span>
                    ))}
                  </div>
                )}
              </div>
              {car.scoreSummary && (
                <p className="modal__score-summary">{car.scoreSummary}</p>
              )}
              {car.scoreBreakdown && (
                <dl className="modal__breakdown">
                  {Object.entries(BREAKDOWN_LABELS).map(([key, label]) => {
                    const val = car.scoreBreakdown[key];
                    if (val == null) return null;
                    return (
                      <div key={key} className="modal__breakdown-row">
                        <dt>{label}</dt>
                        <dd>{val}</dd>
                      </div>
                    );
                  })}
                </dl>
              )}
              {car.adminNotes && !editMode && (
                <div className="modal__admin-notes">
                  <span className="modal__admin-notes-label">Notes</span>
                  <p className="modal__admin-notes-text">{car.adminNotes}</p>
                </div>
              )}
            </div>
          )}

          {car.description && !editMode && (
            <div className="modal__description">
              <h4>Description</h4>
              <p>{car.description}</p>
            </div>
          )}

          {editMode ? (
            <div className="modal__edit-form">
              <h4 className="modal__edit-heading">Edit Listing</h4>
              <div className="modal__edit-grid">
                {EDIT_FIELDS.map(({ key, label, type, options }) => (
                  <div key={key} className={`modal__edit-field${type === 'textarea' ? ' modal__edit-field--full' : ''}`}>
                    <label className="modal__edit-label">{label}</label>
                    {type === 'select' ? (
                      <select
                        className="modal__edit-input"
                        value={editForm[key] ?? ''}
                        onChange={handleEditField(key)}
                      >
                        {options.map((o) => <option key={o} value={o}>{o || `— ${label} —`}</option>)}
                      </select>
                    ) : type === 'textarea' ? (
                      <textarea
                        className="modal__edit-input modal__edit-textarea"
                        value={editForm[key] ?? ''}
                        onChange={handleEditField(key)}
                        rows={4}
                      />
                    ) : (
                      <input
                        className="modal__edit-input"
                        type={type}
                        value={editForm[key] ?? ''}
                        onChange={handleEditField(key)}
                      />
                    )}
                  </div>
                ))}
              </div>
              {editError && <p className="modal__edit-error">{editError}</p>}
              <div className="modal__edit-actions">
                <button className="modal__btn modal__btn--link" onClick={handleEditSave} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button className="modal__btn modal__btn--sold" onClick={() => setEditMode(false)} disabled={editSaving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="modal__actions">
              {isSold ? (
                <div className="modal__sold-banner">✓ Marked as Sold</div>
              ) : (
                <>
                  {(car.hasContact || car.contactNumber) && !revealedNumber && (
                    <button
                      className="modal__btn modal__btn--reveal"
                      onClick={handleReveal}
                      disabled={revealLoading}
                    >
                      {revealLoading ? 'Loading…' : '📞 Show Contact Number'}
                    </button>
                  )}
                  {revealError && (
                    <p className="modal__reveal-error">{revealError}</p>
                  )}
                  {revealedNumber && (
                    <>
                      <p className="modal__revealed-number">📞 {revealedNumber}</p>
                      <a
                        className="modal__btn modal__btn--call"
                        href={`tel:+${revealedNumber}`}
                      >
                        Call Seller
                      </a>
                      <a
                        className="modal__btn modal__btn--whatsapp"
                        href={`https://wa.me/${revealedNumber}?text=${encodeURIComponent(`Hi, I'm interested in the ${car.year} ${car.make} ${car.model}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        💬 WhatsApp
                      </a>
                    </>
                  )}
                  <a
                    className="modal__btn modal__btn--link"
                    href={car.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Listing ↗
                  </a>
                  {isAdmin && (
                    <>
                      <button className="modal__btn modal__btn--edit" onClick={enterEdit}>
                        Edit Listing
                      </button>
                      <button
                        className="modal__btn modal__btn--hide"
                        onClick={handleHideClick}
                        disabled={hideLoading}
                      >
                        {hideLoading ? 'Hiding…' : 'Hide Listing'}
                      </button>
                    </>
                  )}
                  <button
                    className={`modal__btn modal__btn--sold${soldConfirm ? ' modal__btn--confirm' : ''}`}
                    onClick={handleSoldClick}
                    disabled={soldLoading}
                  >
                    {soldLoading ? 'Marking…' : soldConfirm ? 'Confirm Sold?' : 'Mark as Sold'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
