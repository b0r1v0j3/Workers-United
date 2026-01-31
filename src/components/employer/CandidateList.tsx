"use client";

import { Button } from "@/components/ui/Button";
import { Check, Star, MapPin, Briefcase } from "lucide-react";

// Mock Data
const candidates = [
    {
        id: 1,
        name: "Marko Petrović",
        role: "Electrician",
        experience: "5 years",
        location: "Serbia",
        matchScore: 95,
        skills: ["Industrial Wiring", "Blueprints", "German A2"],
    },
    {
        id: 2,
        name: "Jovan Ivić",
        role: "Electrician",
        experience: "3 years",
        location: "Bosnia",
        matchScore: 88,
        skills: ["Residential Wiring", "German B1"],
    },
    {
        id: 3,
        name: "Ivan Horvat",
        role: "Electrician Helper",
        experience: "1 year",
        location: "Croatia",
        matchScore: 75,
        skills: ["Basic Wiring", "English B2"],
    },
];

export function CandidateList() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">Top Matched Candidates</h2>
                <span className="text-sm text-gray-500">Based on your latest job post</span>
            </div>

            {candidates.map((c) => (
                <div key={c.id} className="bg-white rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center gap-4">

                    {/* Avatar / Score */}
                    <div className="flex items-center gap-4 min-w-[200px]">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                            {c.name.charAt(0)}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900">{c.name}</h3>
                            <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full w-fit mt-1">
                                <Star size={12} fill="currentColor" />
                                {c.matchScore}% Match
                            </div>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                            <Briefcase size={14} className="text-gray-400" />
                            {c.role} ({c.experience})
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <MapPin size={14} className="text-gray-400" />
                            From {c.location}
                        </div>
                        <div className="col-span-2 lg:col-span-1 flex flex-wrap gap-1">
                            {c.skills.map(s => (
                                <span key={s} className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">
                                    {s}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 md:ml-auto">
                        <Button variant="outline" size="sm">View Profile</Button>
                        <Button size="sm" className="gap-2">
                            <Check size={16} />
                            Request Interview
                        </Button>
                    </div>

                </div>
            ))}
        </div>
    );
}
