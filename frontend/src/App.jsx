import { useState, useEffect } from "react";

const API_BASE = "https://ai-job-finder-tmiz.onrender.com";

function formatINR(amount) {
  if (!amount) return null;
  const lpa = amount / 100000;
  return `${lpa.toFixed(1)} LPA`;
}

function App() {
  const [role, setRole] = useState("Software Engineer");
  const [city, setCity] = useState("Pune");
  const [expMin, setExpMin] = useState("");
  const [expMax, setExpMax] = useState("");
  const [jobs, setJobs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const jobsPerPage = 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchJobs = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        role,
        city,
      });
      if (expMin) params.append("exp_min", expMin);
      if (expMax) params.append("exp_max", expMax);
      params.append("size", "50"); 
    // ONE call to your backend – backend already has num_pages: 3
const res = await fetch(`${API_BASE}/jobs?${params.toString()}`);

if (!res.ok) {
  throw new Error(`API error: ${res.status}`);
}

const data = await res.json();

// Support both shapes: [] or { jobs: [] }
const jobsFromApi = Array.isArray(data) ? data : (data.jobs || []);

setJobs(jobsFromApi);
setCurrentPage(1); // reset to first page when new results load


    } catch (err) {
      console.error(err);
      setError("Unable to fetch jobs. Check backend is running and API key is set.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "16px", maxWidth: "960px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "8px" }}>India Job Finder</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Search  jobs by role & city, with salary estimations where data is missing.
      </p>

      <form onSubmit={fetchJobs} style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr auto",
        gap: "8px",
        alignItems: "end",
        marginBottom: "16px",
        marginTop: "12px"
      }}>
        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Role / Keywords</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Java Developer, DevOps, Data Engineer"
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#666" }}>City</label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Pune, Bengaluru, Mumbai"
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Min Exp (yrs)</label>
          <input
            type="number"
            min="0"
            value={expMin}
            onChange={(e) => setExpMin(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#666" }}>Max Exp (yrs)</label>
          <input
            type="number"
            min="0"
            value={expMax}
            onChange={(e) => setExpMax(e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "10px 16px",
            cursor: "pointer",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 600
          }}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <div style={{ color: "red", marginBottom: "8px" }}>{error}</div>}

      {!loading && !error && jobs.length === 0 && (
        <div style={{ color: "#666" }}>No jobs found. Try changing role/city.</div>
      )}

      {loading && <div>Loading jobs…</div>}

      <div style={{ display: "grid", gap: "12px", marginTop: "8px" }}>
   // JS area (inside component, before return)
const start = (currentPage - 1) * jobsPerPage;
const end = start + jobsPerPage;
const paginatedJobs = jobs.slice(start, end);

return (
  <>
    <div className="job-list">
      {paginatedJobs.map((job, idx) => (
        <JobCard job={job} key={idx} />
      ))}
    </div>

    {/* ADD PAGINATION BUTTONS HERE */}
    <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "20px" }}>
      <button
        disabled={currentPage === 1}
        onClick={() => setCurrentPage(currentPage - 1)}
        className="apply-btn"
      >
        Previous
      </button>

      <button
        disabled={currentPage === Math.ceil(jobs.length / jobsPerPage)}
        onClick={() => setCurrentPage(currentPage + 1)}
        className="apply-btn"
      >
        Next
      </button>
    </div>
  </>
);


 {
          const hasRealSalary = job.salary_min || job.salary_max;
          const hasEst = job.salary_est_min || job.salary_est_max;

          return (
            <div key={idx} style={{
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "12px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                <div>
                  <h3 style={{ margin: "0 0 4px 0" }}>{job.title}</h3>
                  <div style={{ fontSize: 14, color: "#444" }}>
                    {job.company || "Company confidential"}
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: "2px" }}>
                    {job.city ? job.city : "India"} {job.location && `• ${job.location}`}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 13 }}>
                  {hasRealSalary && (
                    <div>
                      <strong>Salary:</strong>{" "}
                      {job.salary_min && job.salary_max
                        ? `${formatINR(job.salary_min)} – ${formatINR(job.salary_max)}`
                        : job.salary_min
                        ? `From ${formatINR(job.salary_min)}`
                        : job.salary_max
                        ? `Up to ${formatINR(job.salary_max)}`
                        : ""}
                    </div>
                  )}
                  {!hasRealSalary && hasEst && (
                    <div style={{ color: "#2563eb" }}>
                      <strong>Estimated:</strong>{" "}
                      {formatINR(job.salary_est_min)} – {formatINR(job.salary_est_max)}
                    </div>
                  )}
                  {!hasRealSalary && !hasEst && (
                    <div style={{ color: "#999" }}>Salary not available</div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>Source: {job.source}</span>
                {job.posted_at && (
                  <span>
                    Posted: {new Date(job.posted_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {job.apply_url && (
                <div style={{ marginTop: "8px" }}>
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: "#2563eb" }}
                  >
                    View / Apply
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
