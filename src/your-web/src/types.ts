/* Shapes of the baked data snapshots in src/data/*.json — the single source
 * of truth shared by the fetch script's output and every page. */

export interface SnapshotMeta {
  fetchedAt: string;
  scope: string;
  orgs: string[];
}

export interface OrgInfo {
  slug: string;
  name: string;
  repoCount: number;
}

export interface RepoEntry {
  slug: string;
  name: string;
  org: string;
  url: string;
  contributors: number;
  stars: number | null;
  forks: number | null;
  prs: number;
  issues: number;
  reviews: number;
  stargazersInGraph: number;
  type: string | null;
  disciplines: string[];
  languages: string[];
  license: string | null;
  created: string | null;
  description: string | null;
  inMetadataGraph: boolean;
  stub: boolean;
  isFork: boolean;
  forkOf: string | null;
  citationCff: boolean;
  citedBy: number;
  commits: number | null;
  lastCommit: string | null;
  firstCommit: string | null;
}

export interface ReposFile {
  meta: SnapshotMeta;
  orgs: OrgInfo[];
  repos: RepoEntry[];
}

export interface GraphNodeJson {
  id: string;
  type: 'Person' | 'Repository' | 'Organisation' | 'Institution';
  name: string;
  weight?: number;
  lab?: string;
  meta?: string[];
}

export interface GraphEdgeJson {
  source: string;
  target: string;
  type: string;
}

export interface GraphFile {
  meta: SnapshotMeta;
  nodes: GraphNodeJson[];
  edges: GraphEdgeJson[];
  labLinks: { a: string; b: string; shared: number }[];
  stats: { totalUsers: number; keptUsers: number; totalRepos: number; keptRepos: number };
}

export interface MonthPoint {
  m: string;
  commits: number;
  authors: number;
}

export interface HealthFile {
  meta: SnapshotMeta;
  ecosystem: {
    monthly: MonthPoint[];
    growth: { year: string; created: number; cumulative: number }[];
    newContributorsByYear: { year: string; n: number }[];
  };
  totals: {
    commits: number;
    authors: number;
    reposWithCommits: number;
    commits12m: number;
    activeRepos12m: number;
    busFactor: number;
    forksExcluded: number;
  };
  community: {
    topAuthors: { name: string; commits: number; share: number }[];
    authorOrgs: { org: string; commits: number }[];
  };
  perRepo: {
    slug: string;
    org: string;
    isFork: boolean;
    commits: number;
    authors: number | null;
    lastCommit: string | null;
    firstCommit: string | null;
    stars: number | null;
    forks: number | null;
    prs: number;
    issues: number;
    chaoss: Record<string, string> | null;
  }[];
  flagship: {
    slug: string;
    monthly: MonthPoint[];
    contributorGrowth: { m: string; cumulative: number }[];
  };
  chaossTruncated: boolean;
}

export interface ImpactFile {
  meta: SnapshotMeta;
  totals: {
    articles: number;
    withInfoscience: number;
    directRepoCitations: number;
    contributorsWithOrcid: number;
    contributorsTotal: number;
    linkedRepos: number;
    reposWithCff: number;
    reposInMetadataGraph: number;
    reposTotal: number;
  };
  articles: {
    iri: string;
    doi: string | null;
    title: string | null;
    date: string | null;
    infoscience: string | null;
    viaRepos: string[];
    orcids: string[];
  }[];
  orcidInstitutions: { name: string; people: number }[];
}

export interface CoverageFile {
  meta: SnapshotMeta;
  counts: { total: number; forks: number; original: number; inMetadataGraph: number };
  gaps: Record<string, string[]>;
  perOrg: {
    org: string;
    name: string;
    repos: number;
    inMetadataGraph: number;
    noLicense: number;
    noDiscipline: number;
  }[];
}

export interface SummaryFile {
  meta: SnapshotMeta;
  headline: {
    repos: number;
    original: number;
    forks: number;
    contributors: number;
    labs: number;
    disciplines: number;
    publications: number;
    commits: number;
  };
  licenseCoverage: { withLicense: number; inMetadataGraph: number };
}
