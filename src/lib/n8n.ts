// ─── n8n Cloud API Client ────────────────────────────────────────────────────
// Enables programmatic access to n8n workflows from the Workers United codebase.
// Docs: https://docs.n8n.io/api/
//
// Used for: triggering workflows, reading execution logs, managing workflows

const N8N_BASE_URL = process.env.N8N_BASE_URL || "https://b0r1v0j3.app.n8n.cloud";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

interface N8nRequestOptions {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
}

async function n8nFetch<T = unknown>(path: string, opts: N8nRequestOptions = {}): Promise<T> {
    const { method = "GET", body } = opts;

    const res = await fetch(`${N8N_BASE_URL}/api/v1${path}`, {
        method,
        headers: {
            "X-N8N-API-KEY": N8N_API_KEY,
            "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(`n8n API ${method} ${path} failed (${res.status}): ${error}`);
    }

    return res.json();
}

// ─── Workflows ───────────────────────────────────────────────────────────────

export interface N8nWorkflow {
    id: string;
    name: string;
    active: boolean;
    tags: { id: string; name: string }[];
    createdAt: string;
    updatedAt: string;
}

/** List all workflows */
export async function listWorkflows(): Promise<N8nWorkflow[]> {
    const data = await n8nFetch<{ data: N8nWorkflow[] }>("/workflows");
    return data.data;
}

/** Get a specific workflow by ID */
export async function getWorkflow(id: string): Promise<N8nWorkflow> {
    return n8nFetch<N8nWorkflow>(`/workflows/${id}`);
}

/** Activate or deactivate a workflow */
export async function setWorkflowActive(id: string, active: boolean): Promise<N8nWorkflow> {
    return n8nFetch<N8nWorkflow>(`/workflows/${id}`, {
        method: "PATCH",
        body: { active },
    });
}

// ─── Executions ──────────────────────────────────────────────────────────────

export interface N8nExecution {
    id: string;
    finished: boolean;
    mode: string;
    status: "success" | "error" | "waiting" | "running";
    startedAt: string;
    stoppedAt: string;
    workflowId: string;
}

/** Get recent executions (with optional filtering) */
export async function getExecutions(opts?: {
    workflowId?: string;
    status?: "success" | "error" | "waiting";
    limit?: number;
}): Promise<N8nExecution[]> {
    const params = new URLSearchParams();
    if (opts?.workflowId) params.set("workflowId", opts.workflowId);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit) params.set("limit", String(opts.limit));

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await n8nFetch<{ data: N8nExecution[] }>(`/executions${query}`);
    return data.data;
}

/** Get a specific execution by ID */
export async function getExecution(id: string): Promise<N8nExecution> {
    return n8nFetch<N8nExecution>(`/executions/${id}`);
}

// ─── Webhook Triggers ────────────────────────────────────────────────────────

/** Trigger a workflow via its webhook URL */
export async function triggerWebhook(
    webhookPath: string,
    payload: Record<string, unknown>,
    method: "GET" | "POST" = "POST"
): Promise<unknown> {
    const url = `${N8N_BASE_URL}/webhook/${webhookPath}`;

    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(payload) : undefined,
    });

    if (!res.ok) {
        throw new Error(`n8n webhook ${webhookPath} failed (${res.status})`);
    }

    return res.json();
}

// ─── Health Check ────────────────────────────────────────────────────────────

export interface N8nHealth {
    workflowsTotal: number;
    workflowsActive: number;
    recentExecutions: number;
    recentErrors: number;
    lastExecutionAt: string | null;
}

/** Get n8n platform health summary */
export async function getN8nHealth(): Promise<N8nHealth> {
    const [workflows, executions] = await Promise.all([
        listWorkflows(),
        getExecutions({ limit: 50 }),
    ]);

    const errors = executions.filter(e => e.status === "error");
    const lastExec = executions[0];

    return {
        workflowsTotal: workflows.length,
        workflowsActive: workflows.filter(w => w.active).length,
        recentExecutions: executions.length,
        recentErrors: errors.length,
        lastExecutionAt: lastExec?.startedAt || null,
    };
}
