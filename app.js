// Add event listeners when the document loads
document.addEventListener('DOMContentLoaded', function() {
    const channelUrlInput = document.getElementById('channelUrl');
    
    // Add enter key listener
    channelUrlInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            checkMonetization();
        }
    });
});

async function checkMonetization() {
    const channelUrl = document.getElementById('channelUrl').value;
    const resultsDiv = document.getElementById('results');
    const statusMessage = document.getElementById('statusMessage');
    const channelStats = document.getElementById('channelStats');
    const requirements = document.getElementById('requirements');
    const loadingAnimation = document.getElementById('loadingAnimation');

    // Clear previous results
    resultsDiv.classList.add('hidden');
    statusMessage.innerHTML = '';
    channelStats.innerHTML = '';
    requirements.innerHTML = '';
    
    // Remove any existing revenue sections
    const existingRevenueSection = document.getElementById('revenueEstimates');
    if (existingRevenueSection) {
        existingRevenueSection.remove();
    }

    // Show loading animation
    loadingAnimation.classList.remove('hidden');
    
    try {
        const response = await fetch('http://localhost:3000/api/check-monetization', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ channelUrl })
        });

        // Hide loading animation
        loadingAnimation.classList.add('hidden');

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch data');
        }

        const data = await response.json();
        
        // Show results section
        resultsDiv.classList.remove('hidden');

        // Update status message
        statusMessage.innerHTML = data.isMonetized
            ? '<span class="text-green-500">Channel is Monetized ✅</span>'
            : '<span class="text-red-500">Channel is NOT Monetized ❌</span>';

        // Update channel statistics
        channelStats.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg">
                <div class="font-bold text-xl">${data.statistics.subscribers}</div>
                <div class="text-gray-600">Subscribers</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <div class="font-bold text-xl">${data.statistics.views}</div>
                <div class="text-gray-600">Total Views</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <div class="font-bold text-xl">${data.statistics.videos}</div>
                <div class="text-gray-600">Videos</div>
            </div>
        `;

        // Show requirements if not monetized
        if (!data.isMonetized) {
            requirements.innerHTML = `
                <div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
                    <h3 class="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">
                        Monetization Requirements Status
                    </h3>
                    
                    <div class="space-y-5 text-lg">
                        <!-- Subscribers Status -->
                        <div class="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                            <div class="flex items-center space-x-3">
                                <span class="text-2xl">${
                                    data.monetizationStatus.subscribers ? "✅" : "⚠️"
                                }</span>
                                <span class="font-medium text-gray-800">Subscribers</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="${
                                    data.monetizationStatus.subscribers
                                        ? "text-green-600"
                                        : "text-red-600"
                                } font-semibold">
                                    ${data.statistics.subscribers.toLocaleString()}/1,000
                                </span>
                                ${
                                    data.requirements.subscribersNeeded > 0
                                        ? `<span class="text-red-500 text-sm">(Need ${data.requirements.subscribersNeeded.toLocaleString()} more)</span>`
                                        : ""
                                }
                            </div>
                        </div>

                        <!-- Watch Hours Status -->
                        <div class="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                            <div class="flex items-center space-x-3">
                                <span class="text-2xl">${
                                    data.monetizationStatus.watchHours ? "✅" : "⚠️"
                                }</span>
                                <div class="flex flex-col">
                                    <span class="font-medium text-gray-800">Watch Hours</span>
                                    <span class="text-sm text-gray-500">(Last 365 days)</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-end">
                                <div class="flex items-center space-x-2">
                                    <span class="${
                                        data.monetizationStatus.watchHours
                                            ? "text-green-600"
                                            : "text-red-600"
                                    } font-semibold">
                                        ${data.statistics.estimatedWatchHours.toLocaleString()}/4,000
                                    </span>
                                    ${
                                        data.requirements.watchHoursNeeded > 0
                                            ? `<span class="text-red-500 text-sm">(Need ~${data.requirements.watchHoursNeeded.toLocaleString()} more)</span>`
                                            : ""
                                    }
                                </div>
                                <span class="text-xs text-gray-500 mt-1">
                                    *This is an estimate. Check YouTube Studio for exact numbers.
                                </span>
                            </div>
                        </div>

                        <!-- Minimum Videos Status -->
                        <div class="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                            <div class="flex items-center space-x-3">
                                <span class="text-2xl">${
                                    data.monetizationStatus.minimumVideos ? "✅" : "⚠️"
                                }</span>
                                <span class="font-medium text-gray-800">Minimum Videos</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="${
                                    data.monetizationStatus.minimumVideos
                                        ? "text-green-600"
                                        : "text-red-600"
                                } font-semibold">
                                    ${data.statistics.videos.toLocaleString()}/3
                                </span>
                                ${
                                    data.requirements.videosNeeded > 0
                                        ? `<span class="text-red-500 text-sm">(Need ${data.requirements.videosNeeded} more)</span>`
                                        : ""
                                }
                            </div>
                        </div>

                        <!-- Community Guidelines Status -->
                        <div class="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors rounded-lg">
                            <div class="flex items-center space-x-3">
                                <span class="text-2xl">${
                                    data.monetizationStatus.communityGuidelines
                                        ? "✅"
                                        : "⚠️"
                                }</span>
                                <span class="font-medium text-gray-800">Community Guidelines Status</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="${
                                    data.monetizationStatus.communityGuidelines
                                        ? "text-green-600"
                                        : "text-red-600"
                                } font-semibold">
                                    ${
                                        data.requirements.communityGuidelinesStatus
                                            .message
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-8 p-4 bg-blue-50 rounded-lg text-blue-800 text-sm">
                        <p class="font-medium">Keep Going! You're on your way to monetization.</p>
                        <p class="mt-2">
                            Note: Watch hours are estimated and may not reflect exact YouTube Analytics data.
                            For precise numbers, please check your YouTube Studio.
                        </p>
                    </div>
                </div>
            `;
        } else {
            requirements.innerHTML = `
                <div class="text-center p-8 bg-white rounded-xl shadow-lg max-w-2xl mx-auto">
                    <div class="text-3xl font-bold text-green-600 mb-6">
                        ✨ This channel meets all monetization requirements! ✨
                    </div>
                    
                    <div class="space-y-4 text-lg">
                        <div class="flex items-center justify-center space-x-3 p-2 hover:bg-green-50 transition-colors rounded-lg">
                            <span class="text-2xl">✅</span>
                            <span class="font-medium text-gray-800">Over 1,000 subscribers</span>
                        </div>
                        
                        <div class="flex items-center justify-center space-x-3 p-2 hover:bg-green-50 transition-colors rounded-lg">
                            <span class="text-2xl">✅</span>
                            <span class="font-medium text-gray-800">Over 4,000 watch hours</span>
                        </div>
                        
                        <div class="flex items-center justify-center space-x-3 p-2 hover:bg-green-50 transition-colors rounded-lg">
                            <span class="text-2xl">✅</span>
                            <span class="font-medium text-gray-800">More than 3 public videos</span>
                        </div>
                        
                        <div class="flex items-center justify-center space-x-3 p-2 hover:bg-green-50 transition-colors rounded-lg">
                            <span class="text-2xl">✅</span>
                            <span class="font-medium text-gray-800">No community guidelines strikes detected</span>
                        </div>
                    </div>
                    
                    <div class="mt-6 text-sm text-gray-500">
                        Congratulations! Your channel is eligible for YouTube monetization.
                    </div>
                </div>
            `;
        }

        // Add this function to format currency
        function formatCurrency(amount) {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
        }

        // Update the results display section to include revenue estimates
        if (data.isMonetized) {
            // Create revenue section
            const revenueSection = document.createElement("div");
            revenueSection.id = "revenueEstimates";
            revenueSection.className = "mt-8 bg-white p-6 rounded-xl shadow-lg";
            revenueSection.innerHTML = `
                <h3 class="text-2xl font-bold mb-4 text-center">Estimated Monthly Revenue</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-green-50 p-4 rounded-lg">
                        <h4 class="text-lg font-semibold mb-2">Estimated Ad Revenue</h4>
                        <p class="text-2xl text-green-600">
                            ${formatCurrency(data.revenue.monthly.adRevenue.min)} - 
                            ${formatCurrency(data.revenue.monthly.adRevenue.max)}
                        </p>
                        <p class="text-sm text-gray-600 mt-1">per month from ads</p>
                    </div>
                    
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h4 class="text-lg font-semibold mb-2">Total Potential Revenue</h4>
                        <p class="text-2xl text-blue-600">
                            ${formatCurrency(data.revenue.monthly.minRevenue)} - 
                            ${formatCurrency(data.revenue.monthly.maxRevenue)}
                        </p>
                        <p class="text-sm text-gray-600 mt-1">per month (all sources)</p>
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-semibold">Monthly Views</h4>
                        <p class="text-gray-800">${data.revenue.metrics.monthlyViews.toLocaleString()}</p>
                    </div>

                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h4 class="font-semibold">Estimated RPM Range</h4>
                        <p class="text-gray-800">$${data.revenue.metrics.rpm.min} - $${
                            data.revenue.metrics.rpm.max
                        }</p>
                    </div>
                </div>

                <div class="mt-4 text-sm text-gray-500">
                    <p>📊 Based on industry average RPM rates and current view counts</p>
                    <p class="mt-2">
                        Note: These are rough estimates. Actual earnings can vary significantly based on:
                        <ul class="list-disc ml-5 mt-1">
                            <li>Content niche and type</li>
                            <li>Audience location and engagement</li>
                            <li>Seasonality and advertiser demand</li>
                            <li>Ad blocker usage</li>
                        </ul>
                    </p>
                </div>
            `;

            // Add the revenue section after the requirements section
            requirements.parentNode.insertBefore(
                revenueSection,
                requirements.nextSibling
            );
        }
    } catch (error) {
        // Hide loading animation
        loadingAnimation.classList.add('hidden');
        
        console.error('Error details:', error);
        statusMessage.innerHTML = `<span class="text-red-500">Error: ${error.message}</span>`;
    }
}
