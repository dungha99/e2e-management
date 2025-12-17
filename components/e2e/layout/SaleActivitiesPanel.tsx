"use client"

import { useState } from "react"
import { Lead } from "../types"
import { SaleActivitiesTab } from "../tabs/SaleActivitiesTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SaleActivitiesPanelProps {
    selectedLead: Lead | null
    isMobile: boolean
    mobileView: "list" | "detail"
    refreshKey?: number  // Increment to trigger refresh
}

export function SaleActivitiesPanel({
    selectedLead,
    isMobile,
    mobileView,
    refreshKey,
}: SaleActivitiesPanelProps) {
    const [activeTab, setActiveTab] = useState<string>("summary")

    // Hide on mobile when in list view
    if (isMobile && mobileView === "list") {
        return null
    }

    // Only show when a lead is selected
    if (!selectedLead) {
        return null
    }

    const phone = selectedLead.phone || selectedLead.additional_phone || null

    return (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 overflow-hidden flex flex-col">

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="px-3 pt-3">
                    <TabsList className="w-full">
                        <TabsTrigger value="summary" className="flex-1">Summary</TabsTrigger>
                        <TabsTrigger value="activities" className="flex-1">Activities</TabsTrigger>
                    </TabsList>
                </div>

                {/* Summary Tab Content */}
                <TabsContent value="summary" className="flex-1 overflow-y-auto p-3 mt-0">
                    <div className="text-sm text-gray-500 text-center py-8">
                        Summary content will be added here
                    </div>
                </TabsContent>

                {/* Activities Tab Content */}
                <TabsContent value="activities" className="flex-1 overflow-y-auto p-3 mt-0">
                    <SaleActivitiesTab phone={phone} refreshKey={refreshKey} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

