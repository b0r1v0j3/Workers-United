export type SmokeState = "ok" | "degraded" | "down" | "not_configured";

export interface SmokeServiceCheck {
    name: string;
    state: SmokeState;
    required: boolean;
}

export interface SmokeRouteCheck {
    path: string;
    ok: boolean;
    status: number | string;
    latencyMs: number;
}

export interface SmokeEvaluation {
    status: "healthy" | "degraded" | "critical";
    criticalIssues: string[];
    warnings: string[];
}

export function evaluateSmoke(
    services: SmokeServiceCheck[],
    routes: SmokeRouteCheck[]
): SmokeEvaluation {
    const criticalIssues: string[] = [];
    const warnings: string[] = [];

    for (const route of routes) {
        if (!route.ok) {
            criticalIssues.push(`Route ${route.path} failed (${route.status})`);
        } else if (route.latencyMs > 5000) {
            warnings.push(`Route ${route.path} is slow (${route.latencyMs}ms)`);
        }
    }

    for (const service of services) {
        if (service.required && service.state === "down") {
            criticalIssues.push(`Service ${service.name} is down`);
            continue;
        }

        if (service.required && service.state === "degraded") {
            warnings.push(`Service ${service.name} is degraded`);
            continue;
        }

        if (!service.required && service.state === "down") {
            warnings.push(`Optional service ${service.name} is down`);
            continue;
        }

        if (!service.required && service.state === "degraded") {
            warnings.push(`Optional service ${service.name} is degraded`);
            continue;
        }

        if (service.state === "not_configured") {
            warnings.push(`Service ${service.name} is not configured`);
        }
    }

    if (criticalIssues.length > 0) {
        return { status: "critical", criticalIssues, warnings };
    }

    if (warnings.length > 0) {
        return { status: "degraded", criticalIssues, warnings };
    }

    return { status: "healthy", criticalIssues, warnings };
}
