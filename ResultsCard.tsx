import React from "react";

interface AnalysisResult {
  project_id: string;
  cost: number;
  materials: string[];
  score: number;
  explanation: string;
}

interface ResultsCardProps {
  data: AnalysisResult;
}

export function ResultsCard({ data }: ResultsCardProps) {
  const formatCost = (cost: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(cost);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "#34d399"; // green
    if (score >= 0.6) return "#fbbf24"; // amber
    return "#f87171"; // red
  };

  const getQualityLabel = (score: number) => {
    if (score >= 0.85) return "Excellent";
    if (score >= 0.75) return "Very Good";
    if (score >= 0.65) return "Good";
    if (score >= 0.55) return "Fair";
    return "Needs Review";
  };

  return (
    <div className="results-container">
      {/* PROJECT ID */}
      <div className="result-row">
        <div className="result-label">
          <span className="label-icon">📋</span>
          <span>Project ID</span>
        </div>
        <div className="result-value project-id">{data.project_id}</div>
      </div>

      {/* COST */}
      <div className="result-row">
        <div className="result-label">
          <span className="label-icon">💰</span>
          <span>Estimated Cost</span>
        </div>
        <div className="result-value cost">{formatCost(data.cost)}</div>
      </div>

      {/* QUALITY SCORE */}
      <div className="result-row">
        <div className="result-label">
          <span className="label-icon">⭐</span>
          <span>Quality Score</span>
        </div>
        <div className="result-value">
          <div className="score-display">
            <div
              className="score-bar"
              style={{
                width: `${data.score * 100}%`,
                backgroundColor: getScoreColor(data.score),
              }}
            />
          </div>
          <span style={{ color: getScoreColor(data.score), fontWeight: "600" }}>
            {(data.score * 100).toFixed(0)}% - {getQualityLabel(data.score)}
          </span>
        </div>
      </div>

      {/* RECOMMENDED MATERIALS */}
      <div className="result-row full-width">
        <div className="result-label">
          <span className="label-icon">🏗️</span>
          <span>Recommended Materials</span>
        </div>
        <div className="materials-list">
          {data.materials.map((material, idx) => (
            <span key={idx} className="material-badge">
              {material}
            </span>
          ))}
        </div>
      </div>

      {/* EXPLANATION */}
      <div className="result-row full-width">
        <div className="result-label">
          <span className="label-icon">📝</span>
          <span>Analysis Summary</span>
        </div>
        <div className="explanation-text">{data.explanation}</div>
      </div>
    </div>
  );
}
