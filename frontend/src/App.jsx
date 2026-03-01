import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, ethers } from "ethers";
import { bountyAbi } from "./lib/bountyAbi";
import { factoryAbi } from "./lib/factoryAbi";
import { FACTORY_ADDRESS, FUJI_PARAMS, WALLETCONNECT_PROJECT_ID } from "./lib/config";

const FUJI_CHAIN_ID = 43113;
const PROFILE_TABS = ["Activity", "Work", "Showcase", "Details"];

function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getStatus(bounty) {
  if (bounty.resolved) return "Completed";
  const now = Math.floor(Date.now() / 1000);
  const hoursLeft = (bounty.deadline - now) / 3600;
  if (hoursLeft <= 24) return "Ending Soon";
  if (Number(bounty.reward) >= 1) return "Hot";
  return "Open";
}

function getInjectedProvider() {
  const eth = window.ethereum;
  if (!eth) return window.avalanche || null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const core = eth.providers.find((p) => p.isAvalanche);
    return core || eth.providers[0];
  }
  return window.avalanche || eth;
}

function getPath() {
  return window.location.pathname || "/";
}

function extractErrorMessage(err) {
  const candidates = [
    err?.shortMessage,
    err?.reason,
    err?.info?.error?.message,
    err?.error?.message,
    err?.data?.message,
    err?.cause?.message,
    err?.message
  ].filter(Boolean);

  const raw = String(candidates[0] || "Transaction failed");
  const lower = raw.toLowerCase();

  if (lower.includes("could not coalesce error")) {
    return "RPC/provider error. Check wallet network (Fuji) and RPC settings, then retry.";
  }
  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction was rejected in wallet.";
  }
  if (lower.includes("insufficient funds")) {
    return "Insufficient AVAX for value + gas. Fund your wallet and retry.";
  }

  const revertedMatch = raw.match(/execution reverted(?::\s*)?"?([^"]+)"?/i);
  if (revertedMatch?.[1]) {
    return revertedMatch[1];
  }

  return raw;
}

export default function App() {
  const [walletProvider, setWalletProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bounties, setBounties] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Open");
  const [myBountiesTab, setMyBountiesTab] = useState("View");
  const [profileTab, setProfileTab] = useState("Activity");
  const [activityFeed, setActivityFeed] = useState([]);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [path, setPath] = useState(getPath());
  const [bountyDetail, setBountyDetail] = useState(null);
  const [submissionInput, setSubmissionInput] = useState({ url: "", notes: "", fileName: "" });

  const [profileDraft, setProfileDraft] = useState({
    picture: "",
    displayName: "",
    bio: "",
    skills: "",
    social: ""
  });

  const [form, setForm] = useState({ title: "", description: "", reward: "", deadline: "" });
  const hasValidFactoryAddress = ethers.isAddress(FACTORY_ADDRESS);

  const readProvider = useMemo(() => new JsonRpcProvider(FUJI_PARAMS.rpcUrls[0]), []);

  const factory = useMemo(() => {
    if (!hasValidFactoryAddress) return null;
    return new Contract(FACTORY_ADDRESS, factoryAbi, readProvider);
  }, [hasValidFactoryAddress, readProvider]);

  const isProfileRoute = path === "/profile" || path === "/profile/edit";
  const isMyBountiesRoute = path === "/my-bounties";
  const bountyMatch = path.match(/^\/bounty\/(.+)$/);
  const selectedBountyAddress = bountyMatch ? decodeURIComponent(bountyMatch[1]) : "";

  const isProtectedRoute = isProfileRoute || isMyBountiesRoute;

  const filteredBounties = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bounties.filter((b) => {
      const status = getStatus(b);
      const progressStatus = b.resolved ? "Completed" : b.submissions > 0 ? "In Progress" : "Open";
      const filterMatch =
        filter === "Open"
          ? !b.resolved
          : filter === "In Progress"
            ? progressStatus === "In Progress"
            : b.resolved;

      if (!filterMatch) return false;
      if (!term) return true;
      return (
        b.title.toLowerCase().includes(term) ||
        b.description.toLowerCase().includes(term) ||
        b.poster.toLowerCase().includes(term) ||
        status.toLowerCase().includes(term)
      );
    });
  }, [bounties, filter, search]);

  const myBounties = useMemo(() => {
    if (!address) return [];
    return bounties.filter((b) => b.poster.toLowerCase() === address.toLowerCase());
  }, [address, bounties]);

  const profileMetrics = useMemo(() => {
    if (!address) return { projectsCompleted: 0, earningsAvax: 0, xp: 0, progress: 0 };
    const projectsCompleted = myBounties.filter((b) => b.resolved).length;
    const earningsAvax = bounties
      .filter((b) => b.winner && b.winner.toLowerCase() === address.toLowerCase())
      .reduce((sum, b) => sum + Number(b.reward), 0);
    const xp = projectsCompleted * 250 + activityFeed.length * 40;
    const progress = Math.min(100, Math.round((xp % 2000) / 20));
    return { projectsCompleted, earningsAvax, xp, progress };
  }, [address, myBounties, bounties, activityFeed]);

  function navigate(to) {
    if (window.location.pathname === to) return;
    window.history.pushState({}, "", to);
    setPath(to);
  }

  function routeLabel() {
    if (path === "/") return "Explore";
    if (path === "/my-bounties") return "My Bounties";
    if (path === "/profile" || path === "/profile/edit") return "Profile";
    return "Explore";
  }

  async function switchToFuji(rawProvider) {
    try {
      await rawProvider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: FUJI_PARAMS.chainId }] });
    } catch {
      await rawProvider.request({ method: "wallet_addEthereumChain", params: [FUJI_PARAMS] });
    }
  }

  async function withAction(action, pendingText) {
    setError("");
    setNotice(pendingText || "Working...");
    setBusy(true);
    try {
      await action();
      setNotice("Done.");
    } catch (err) {
      const message = extractErrorMessage(err);
      setError(message);
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  async function connectInjectedWallet() {
    const raw = getInjectedProvider();
    if (!raw) throw new Error("No injected wallet found.");

    await raw.request({ method: "eth_requestAccounts" });
    await switchToFuji(raw);

    const provider = new BrowserProvider(raw);
    const s = await provider.getSigner();
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== FUJI_CHAIN_ID) {
      throw new Error("Please switch wallet to Avalanche Fuji (43113)");
    }

    setWalletProvider(provider);
    setSigner(s);
    setAddress(await s.getAddress());
  }

  async function connectWalletConnect() {
    if (!WALLETCONNECT_PROJECT_ID) {
      throw new Error("Missing VITE_WALLETCONNECT_PROJECT_ID in frontend/.env");
    }
    const { default: EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const wc = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [FUJI_CHAIN_ID],
      showQrModal: true
    });
    await wc.enable();

    const provider = new BrowserProvider(wc);
    const s = await provider.getSigner();
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== FUJI_CHAIN_ID) {
      throw new Error("Please switch wallet to Avalanche Fuji (43113)");
    }

    setWalletProvider(provider);
    setSigner(s);
    setAddress(await s.getAddress());
  }

  async function connectWallet() {
    await withAction(async () => {
      const hasInjected = !!getInjectedProvider();
      if (hasInjected) {
        try {
          await connectInjectedWallet();
          return;
        } catch (err) {
          if (!WALLETCONNECT_PROJECT_ID) throw err;
        }
      }
      await connectWalletConnect();
    }, "Connecting wallet...");
  }

  function disconnectWallet() {
    setWalletProvider(null);
    setSigner(null);
    setAddress("");
    setDisplayName("");
    setActivityFeed([]);
    setWalletMenuOpen(false);
    setNotice("");
    setError("");
    navigate("/");
  }

  async function loadBounties() {
    if (!factory) return;

    setError("");
    const list = await factory.getBounties();
    const rows = await Promise.all(
      list.map(async (addr) => {
        const b = new Contract(addr, bountyAbi, readProvider);
        const submissionCount = await b.getSubmissionCount();
        return {
          addr,
          title: await b.title(),
          description: await b.description(),
          poster: await b.poster(),
          reward: ethers.formatEther(await b.reward()),
          deadline: Number(await b.deadline()),
          resolved: await b.resolved(),
          winner: await b.winner(),
          submissions: Number(submissionCount)
        };
      })
    );

    rows.sort((a, b) => b.deadline - a.deadline);
    setBounties(rows);
  }

  async function loadBountyDetail(bountyAddr) {
    if (!ethers.isAddress(bountyAddr)) {
      setBountyDetail(null);
      return;
    }
    const b = new Contract(bountyAddr, bountyAbi, readProvider);
    const submissionCount = Number(await b.getSubmissionCount());
    const submissions = [];
    for (let i = 0; i < submissionCount; i += 1) {
      const s = await b.getSubmission(i);
      submissions.push({
        id: i,
        contributor: s.contributor,
        uri: s.uri,
        timestamp: Number(s.timestamp),
        approved: s.approved
      });
    }
    setBountyDetail({
      addr: bountyAddr,
      title: await b.title(),
      description: await b.description(),
      poster: await b.poster(),
      reward: ethers.formatEther(await b.reward()),
      deadline: Number(await b.deadline()),
      resolved: await b.resolved(),
      submissions
    });
  }

  async function loadProfileIdentity() {
    if (!walletProvider || !address) {
      setDisplayName("");
      return;
    }
    try {
      const ens = await walletProvider.lookupAddress(address);
      setDisplayName(ens || "");
    } catch {
      setDisplayName("");
    }
  }

  async function loadProfileActivity() {
    if (!factory || !address) {
      setActivityFeed([]);
      return;
    }

    const feed = [];
    try {
      const createdEvents = await factory.queryFilter(factory.filters.BountyCreated(null, address));
      for (const ev of createdEvents) {
        const block = await readProvider.getBlock(ev.blockNumber);
        feed.push({
          id: `created-${ev.transactionHash}`,
          type: "Bounty Created",
          title: ev.args?.title || "New bounty",
          subtitle: `Reward: ${ethers.formatEther(ev.args?.reward || 0n)} AVAX`,
          timestamp: block?.timestamp || 0
        });
      }
    } catch {
      // Continue if event query fails.
    }

    for (const bounty of bounties) {
      const contract = new Contract(bounty.addr, bountyAbi, readProvider);
      for (let i = 0; i < bounty.submissions; i += 1) {
        const submission = await contract.getSubmission(i);
        if (submission.contributor.toLowerCase() === address.toLowerCase()) {
          feed.push({
            id: `submission-${bounty.addr}-${i}`,
            type: "Submission Added",
            title: bounty.title,
            subtitle: submission.uri,
            timestamp: Number(submission.timestamp)
          });
        }
      }
    }

    feed.sort((a, b) => b.timestamp - a.timestamp);
    setActivityFeed(feed.slice(0, 20));
  }

  async function createBounty(e) {
    e.preventDefault();

    await withAction(async () => {
      if (!signer) throw new Error("Connect wallet first");
      if (!hasValidFactoryAddress) throw new Error("Factory address is invalid.");

      const deadlineUnix = Math.floor(new Date(form.deadline).getTime() / 1000);
      if (!Number.isFinite(deadlineUnix) || deadlineUnix <= Math.floor(Date.now() / 1000)) {
        throw new Error("Deadline must be a future date/time");
      }
      if (!/^\d+(\.\d{1,18})?$/.test(form.reward.trim())) {
        throw new Error("Reward must be a valid AVAX amount");
      }

      const c = new Contract(FACTORY_ADDRESS, factoryAbi, signer);
      const tx = await c.createBounty(form.title.trim(), form.description.trim(), deadlineUnix, {
        value: ethers.parseEther(form.reward.trim())
      });
      setNotice("Waiting for bounty creation confirmation...");
      await tx.wait();

      setForm({ title: "", description: "", reward: "", deadline: "" });
      setMyBountiesTab("View");
      navigate("/my-bounties");
      await loadBounties();
    }, "Creating bounty...");
  }

  async function submitWork(bountyAddr, payload) {
    await withAction(async () => {
      if (!signer) throw new Error("Connect wallet first");
      const b = new Contract(bountyAddr, bountyAbi, signer);
      const uri = payload?.trim();
      if (!uri) throw new Error("Submission is required.");

      const tx = await b.submitWork(uri);
      setNotice("Waiting for submission confirmation...");
      await tx.wait();
      await loadBounties();
      if (path.startsWith("/bounty/")) {
        await loadBountyDetail(bountyAddr);
      }
    }, "Submitting work...");
  }

  async function approveSubmission(bountyAddr, submissionId) {
    await withAction(async () => {
      if (!signer) throw new Error("Connect wallet first");
      const b = new Contract(bountyAddr, bountyAbi, signer);
      let id = submissionId;
      if (id === undefined || id === null) {
        const promptId = prompt("Submission ID to approve");
        if (promptId === null) return;
        id = Number(promptId);
      }
      if (!Number.isInteger(Number(id)) || Number(id) < 0) {
        throw new Error("Submission ID must be a non-negative integer");
      }

      const tx = await b.approveSubmission(Number(id));
      setNotice("Waiting for winner approval confirmation...");
      await tx.wait();
      await loadBounties();
      if (path.startsWith("/bounty/")) {
        await loadBountyDetail(bountyAddr);
      }
    }, "Approving submission...");
  }

  async function cancelBounty(bountyAddr) {
    await withAction(async () => {
      if (!signer) throw new Error("Connect wallet first");
      const b = new Contract(bountyAddr, bountyAbi, signer);
      const tx = await b.cancelBounty();
      setNotice("Waiting for cancel confirmation...");
      await tx.wait();
      await loadBounties();
      if (path.startsWith("/bounty/")) {
        await loadBountyDetail(bountyAddr);
      }
    }, "Canceling bounty...");
  }

  useEffect(() => {
    const onPopState = () => setPath(getPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    loadBounties();
  }, [factory]);

  useEffect(() => {
    if (isProtectedRoute && !address) {
      navigate("/");
    }
  }, [isProtectedRoute, address]);

  useEffect(() => {
    loadProfileIdentity();
  }, [address, walletProvider]);

  useEffect(() => {
    if (path === "/profile" && address) {
      loadProfileActivity();
    }
  }, [path, address, bounties]);

  useEffect(() => {
    if (selectedBountyAddress) {
      loadBountyDetail(selectedBountyAddress);
    } else {
      setBountyDetail(null);
    }
  }, [selectedBountyAddress, bounties]);

  const currentRoute = routeLabel();

  function BountyCards({ list }) {
    return (
      <div className="card-grid">
        {list.map((b) => {
          const status = getStatus(b);
          const isCreator = address && b.poster.toLowerCase() === address.toLowerCase();
          const canCancel = isCreator && b.submissions === 0 && !b.resolved;
          const canApprove = isCreator && b.submissions > 0 && !b.resolved;

          return (
            <article key={b.addr} className="bounty-card glass">
              <div className="card-head">
                <div className="avatar">{b.poster.slice(2, 4).toUpperCase()}</div>
                <span className={`status ${status.toLowerCase().replace(" ", "-")}`}>{status}</span>
              </div>
              <h3>{b.title}</h3>
              <p>{b.description}</p>
              <div className="reward">{b.reward} AVAX</div>
              <div className="meta-row">
                <span>Deadline: {new Date(b.deadline * 1000).toLocaleString()}</span>
                <span>Submissions: {b.submissions}</span>
              </div>
              <div className="actions">
                {!isCreator && (
                  <button onClick={() => navigate(`/bounty/${encodeURIComponent(b.addr)}`)} disabled={busy}>
                    Submit
                  </button>
                )}
                {canApprove && (
                  <>
                    <button onClick={() => approveSubmission(b.addr)} disabled={busy}>Approve</button>
                  </>
                )}
                {canCancel && <button onClick={() => cancelBounty(b.addr)} disabled={busy}>Cancel</button>}
              </div>
            </article>
          );
        })}
        {list.length === 0 && <p className="empty">No bounties found.</p>}
      </div>
    );
  }

  function renderExplore() {
    return (
      <>
        <section className="search-and-filters glass">
          <input
            className="search"
            placeholder="Search bounties by title, creator, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="chips">
            {["Open", "In Progress", "Completed"].map((chip) => (
              <button
                key={chip}
                className={filter === chip ? "chip active" : "chip"}
                onClick={() => setFilter(chip)}
                disabled={busy}
              >
                {chip}
              </button>
            ))}
            <button className="chip" onClick={loadBounties} disabled={busy}>Refresh</button>
          </div>
        </section>
        <section className="panel glass">
          <div className="panel-head">
            <h2>Explore Bounties</h2>
            <span className="meta-chip">{filteredBounties.length} shown</span>
          </div>
          <BountyCards list={filteredBounties} />
        </section>
      </>
    );
  }

  function renderMyBounties() {
    return (
      <section className="panel glass">
        <div className="panel-head">
          <h2>My Bounties</h2>
          <div className="tab-row">
            <button className={myBountiesTab === "View" ? "tab-btn active" : "tab-btn"} onClick={() => setMyBountiesTab("View")}>
              View My Bounties
            </button>
            <button className={myBountiesTab === "Create" ? "tab-btn active" : "tab-btn"} onClick={() => setMyBountiesTab("Create")}>
              Create New Bounty
            </button>
          </div>
        </div>

        {myBountiesTab === "View" ? (
          <BountyCards list={myBounties} />
        ) : (
          <form className="create-form" onSubmit={createBounty}>
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              disabled={busy}
            />
            <input
              placeholder="Reward in AVAX"
              value={form.reward}
              onChange={(e) => setForm({ ...form, reward: e.target.value })}
              required
              disabled={busy}
            />
            <textarea
              placeholder="Describe the task and acceptance criteria"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
              disabled={busy}
            />
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              required
              disabled={busy}
            />
            <button className="form-btn" type="submit" disabled={busy}>Create Bounty</button>
          </form>
        )}
      </section>
    );
  }

  function renderBountyDetail() {
    if (!bountyDetail) {
      return (
        <section className="panel glass">
          <h2>Bounty detail unavailable.</h2>
        </section>
      );
    }

    const isCreator = address && bountyDetail.poster.toLowerCase() === address.toLowerCase();
    const mySubmission = bountyDetail.submissions.find((s) => address && s.contributor.toLowerCase() === address.toLowerCase());
    const myStatus = mySubmission ? (mySubmission.approved ? "Approved" : "Pending Approval") : "Not submitted";
    const submissionPayload = JSON.stringify({
      url: submissionInput.url.trim(),
      notes: submissionInput.notes.trim(),
      fileName: submissionInput.fileName || ""
    });

    return (
      <section className="panel glass">
        <div className="panel-head">
          <h2>{bountyDetail.title}</h2>
          <span className="meta-chip">{bountyDetail.reward} AVAX</span>
        </div>
        <p>{bountyDetail.description}</p>
        <p className="detail-line"><strong>Requirements:</strong> Complete the requested work and provide verifiable proof.</p>
        <p className="detail-line"><strong>Deadline:</strong> {new Date(bountyDetail.deadline * 1000).toLocaleString()}</p>
        <p className="detail-line"><strong>Submission instructions:</strong> Provide URL/text/file note below.</p>

        {!isCreator && (
          <div className="submission-box">
            <input
              placeholder="Submission URL"
              value={submissionInput.url}
              onChange={(e) => setSubmissionInput({ ...submissionInput, url: e.target.value })}
              disabled={busy}
            />
            <textarea
              placeholder="Additional notes"
              value={submissionInput.notes}
              onChange={(e) => setSubmissionInput({ ...submissionInput, notes: e.target.value })}
              disabled={busy}
            />
            <input
              type="file"
              onChange={(e) => setSubmissionInput({ ...submissionInput, fileName: e.target.files?.[0]?.name || "" })}
              disabled={busy}
            />
            <button className="form-btn" onClick={() => submitWork(bountyDetail.addr, submissionPayload)} disabled={busy}>
              Submit Confirmation
            </button>
            <p className="detail-line"><strong>Status:</strong> {myStatus}</p>
          </div>
        )}

        {isCreator && (
          <section className="panel glass">
            <div className="panel-head">
              <h2>Submissions</h2>
            </div>
            <div className="activity-feed">
              {bountyDetail.submissions.map((s) => (
                <article key={s.id} className="activity-card">
                  <div className="activity-top">
                    <span className="meta-chip">{s.approved ? "Approved" : "Pending Approval"}</span>
                    <span>{new Date(s.timestamp * 1000).toLocaleString()}</span>
                  </div>
                  <p>{shortAddress(s.contributor)}</p>
                  <p>{s.uri}</p>
                  {!s.approved && (
                    <button className="tab-btn" onClick={() => approveSubmission(bountyDetail.addr, s.id)} disabled={busy}>
                      Approve
                    </button>
                  )}
                </article>
              ))}
              {bountyDetail.submissions.length === 0 && <p className="empty">No submissions yet.</p>}
            </div>
            {bountyDetail.submissions.length === 0 && !bountyDetail.resolved && (
              <button className="tab-btn" onClick={() => cancelBounty(bountyDetail.addr)} disabled={busy}>Cancel</button>
            )}
          </section>
        )}
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className="profile-zone">
        <section className="profile-header glass">
          <div className="profile-avatar">{(displayName || shortAddress(address)).slice(0, 1).toUpperCase()}</div>
          <div className="profile-meta">
            <h2>{displayName || "Anonymous Builder"}</h2>
            <p>{shortAddress(address)}</p>
            <div className="profile-badges">
              <span className="meta-chip">Contributor</span>
              <span className="meta-chip">Community Manager</span>
            </div>
            <p className="bio">Building trustless workflows and shipping on-chain bounty outcomes on Avalanche.</p>
          </div>
          <div className="profile-actions">
            <button className="tab-btn" onClick={() => navigate("/profile/edit")}>Edit Profile</button>
            <button className="tab-btn">Share</button>
          </div>
        </section>

        <section className="panel glass">
          <div className="tab-row">
            {PROFILE_TABS.map((tab) => (
              <button key={tab} className={profileTab === tab ? "tab-btn active" : "tab-btn"} onClick={() => setProfileTab(tab)}>
                {tab}
              </button>
            ))}
          </div>
        </section>

        <section className="profile-grid">
          <section className="glass rail-card">
            <h4>Projects Completed</h4>
            <div className="metric">{profileMetrics.projectsCompleted}</div>
          </section>
          <section className="glass rail-card">
            <h4>Earnings</h4>
            <div className="metric">{profileMetrics.earningsAvax.toFixed(3)} AVAX</div>
            <p>~ ${(profileMetrics.earningsAvax * 28).toFixed(2)} USD</p>
          </section>
          <section className="glass rail-card">
            <h4>XP Earned</h4>
            <div className="metric">{profileMetrics.xp}</div>
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${profileMetrics.progress}%` }} />
            </div>
            <button className="tab-btn">View Details</button>
          </section>
          <section className="glass rail-card">
            <h4>On-Chain Snapshot</h4>
            <p>Factory: {shortAddress(FACTORY_ADDRESS)}</p>
            <p>Network: Fuji (43113)</p>
            <p>Wallet: {shortAddress(address)}</p>
          </section>
        </section>

        {profileTab === "Activity" && (
          <section className="panel glass">
            <div className="panel-head">
              <h2>Activity Feed</h2>
            </div>
            <div className="activity-feed">
              {activityFeed.map((item) => (
                <article key={item.id} className="activity-card">
                  <div className="activity-top">
                    <span className="meta-chip">{item.type}</span>
                    <span>{item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : "Recent"}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </article>
              ))}
              {activityFeed.length === 0 && <p className="empty">No activity yet.</p>}
            </div>
          </section>
        )}
      </section>
    );
  }

  function renderProfileEdit() {
    return (
      <section className="panel glass">
        <div className="panel-head">
          <h2>Edit Profile</h2>
        </div>
        <form
          className="create-form"
          onSubmit={(e) => {
            e.preventDefault();
            setDisplayName(profileDraft.displayName.trim() || displayName);
            setNotice("Profile updated.");
            navigate("/profile");
          }}
        >
          <input
            type="file"
            onChange={(e) =>
              setProfileDraft({
                ...profileDraft,
                picture: e.target.files?.[0] ? URL.createObjectURL(e.target.files[0]) : profileDraft.picture
              })
            }
            disabled={busy}
          />
          <input
            placeholder="Display name"
            value={profileDraft.displayName}
            onChange={(e) => setProfileDraft({ ...profileDraft, displayName: e.target.value })}
            disabled={busy}
          />
          <textarea
            placeholder="Bio"
            value={profileDraft.bio}
            onChange={(e) => setProfileDraft({ ...profileDraft, bio: e.target.value })}
            disabled={busy}
          />
          <input
            placeholder="Skills / Specialization"
            value={profileDraft.skills}
            onChange={(e) => setProfileDraft({ ...profileDraft, skills: e.target.value })}
            disabled={busy}
          />
          <input
            placeholder="Social links (optional)"
            value={profileDraft.social}
            onChange={(e) => setProfileDraft({ ...profileDraft, social: e.target.value })}
            disabled={busy}
          />
          <button className="form-btn" type="submit" disabled={busy}>Save</button>
          <button type="button" className="tab-btn" onClick={() => navigate("/profile")} disabled={busy}>Cancel</button>
        </form>
      </section>
    );
  }

  return (
    <main className="app">
      <header className="top-shell glass">
        <div className="brand">GOATED</div>
        <nav className="header-nav">
          <button className={currentRoute === "Explore" ? "nav-btn active" : "nav-btn"} onClick={() => navigate("/")}>
            Explore
          </button>
        </nav>
        <div className="top-right">
          {!address ? (
            <button className="wallet-btn core" onClick={connectWallet} disabled={busy}>Connect Wallet</button>
          ) : (
            <div className="wallet-menu-wrap">
              <button className="wallet-indicator" onClick={() => setWalletMenuOpen((v) => !v)}>
                {displayName || shortAddress(address)}
              </button>
              {walletMenuOpen && (
                <div className="wallet-dropdown glass">
                  <button onClick={() => { setWalletMenuOpen(false); navigate("/my-bounties"); }}>My Bounties</button>
                  <button onClick={() => { setWalletMenuOpen(false); navigate("/profile"); }}>Profile</button>
                  <button onClick={disconnectWallet}>Disconnect Wallet</button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="hero glass">
        <h1>Decentralized Bounty Marketplace on Avalanche</h1>
      </section>

      <section className="main-zone">
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}
        {!hasValidFactoryAddress && <p className="error">Factory address is invalid. Update config with a deployed 0x... address.</p>}

        {path === "/" && renderExplore()}
        {path === "/my-bounties" && address && renderMyBounties()}
        {path === "/profile" && address && renderProfile()}
        {path === "/profile/edit" && address && renderProfileEdit()}
        {bountyMatch && renderBountyDetail()}
      </section>
    </main>
  );
}
