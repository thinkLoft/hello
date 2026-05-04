import React from 'react';
import './DealRatingBadge.css';

function getRating(score) {
  if (score == null) return null;
  if (score >= 75) return { label: 'Great Deal', tier: 'great' };
  if (score >= 50) return { label: 'Fair Price', tier: 'fair' };
  if (score >= 25) return { label: 'Below Avg', tier: 'below' };
  return { label: 'Overpriced', tier: 'over' };
}

export default function DealRatingBadge({ score, size = 'sm', showScore = false }) {
  const rating = getRating(score);
  if (!rating) return null;
  return (
    <span className={`deal-badge deal-badge--${rating.tier} deal-badge--${size}`}>
      {rating.label}{showScore ? ` · ${score}` : ''}
    </span>
  );
}
