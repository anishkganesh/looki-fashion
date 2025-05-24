// Trend Analyzer Module
// Contains logic for analyzing fashion trends and calculating metrics

const axios = require('axios');

class TrendAnalyzer {
    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY || 'REDACTED_OPENAI_KEY';
        
        this.trendKeywords = {
            color: ['color', 'hue', 'shade', 'tone', 'palette', 'vibrant', 'muted', 'pastel', 'neon', 'metallic', 
                    'bright', 'dark', 'light', 'bold', 'neutral', 'monochrome', 'colorful', 'chromatic', 'pantone'],
            style: ['style', 'aesthetic', 'look', 'vibe', 'fashion', 'trend', 'chic', 'elegant', 'casual', 'formal',
                    'minimalist', 'maximalist', 'vintage', 'modern', 'contemporary', 'classic', 'edgy', 'bohemian'],
            material: ['fabric', 'material', 'textile', 'cotton', 'silk', 'wool', 'leather', 'denim', 'linen', 'synthetic',
                       'cashmere', 'velvet', 'satin', 'polyester', 'nylon', 'knit', 'woven', 'mesh', 'suede', 'fleece'],
            pattern: ['pattern', 'print', 'stripe', 'floral', 'geometric', 'abstract', 'polka dot', 'plaid', 'check',
                      'animal print', 'leopard', 'zebra', 'paisley', 'tie-dye', 'camo', 'camouflage', 'checkered', 'houndstooth'],
            silhouette: ['silhouette', 'fit', 'cut', 'shape', 'oversized', 'fitted', 'loose', 'tight', 'flowing', 'structured',
                         'tailored', 'relaxed', 'slim', 'wide', 'cropped', 'elongated', 'boxy', 'form-fitting', 'draped']
        };

        this.lifecycleKeywords = {
            emerging: ['new', 'upcoming', 'debut', 'introducing', 'launching', 'preview', 'sneak peek', 'first look'],
            growing: ['trending', 'popular', 'rising', 'gaining', 'spreading', 'viral', 'hot', 'must-have'],
            peak: ['everywhere', 'dominating', 'mainstream', 'ubiquitous', 'essential', 'staple', 'classic'],
            declining: ['fading', 'less popular', 'outdated', 'past', 'yesterday\'s', 'old', 'tired'],
            dormant: ['retro', 'vintage', 'throwback', 'revival', 'comeback', 'nostalgic']
        };
    }

    // Process description with OpenAI
    async processDescriptionWithOpenAI(trendIdentifier, rawDescription) {
        try {
            const trendName = trendIdentifier.replace(/-/g, ' ');
            
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a fashion industry analyst. Summarize fashion trends in exactly 2 sentences with a business focus. First sentence should describe what the trend is. Second sentence should explain its business impact or market opportunity.'
                        },
                        {
                            role: 'user',
                            content: `Summarize this fashion trend "${trendName}" based on this context: ${rawDescription.slice(0, 500)}`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 100
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.choices && response.data.choices[0]) {
                return response.data.choices[0].message.content.trim();
            }
        } catch (error) {
            console.error('OpenAI API error:', error.response?.data || error.message);
        }

        // Fallback to basic extraction if OpenAI fails
        return this.extractTrendDescription(trendIdentifier, rawDescription);
    }

    // Extract trend description from content (fallback method)
    extractTrendDescription(trendIdentifier, content) {
        const trendName = trendIdentifier.replace(/-/g, ' ');
        const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
        
        // Find sentences that mention the trend
        const relevantSentences = sentences.filter(sentence => {
            const sentenceLower = sentence.toLowerCase();
            return sentenceLower.includes(trendName) || 
                   trendName.split(' ').some(word => word.length > 3 && sentenceLower.includes(word));
        });
        
        // If we found relevant sentences, use them
        if (relevantSentences.length > 0) {
            return relevantSentences.slice(0, 2).join(' ').trim();
        }
        
        // Otherwise, find sentences with trend-related keywords
        const trendSentences = sentences.filter(sentence => {
            const sentenceLower = sentence.toLowerCase();
            return sentenceLower.includes('trend') || sentenceLower.includes('fashion') || 
                   sentenceLower.includes('style') || sentenceLower.includes('popular');
        });
        
        if (trendSentences.length > 0) {
            return trendSentences.slice(0, 2).join(' ').trim();
        }
        
        // Fallback: return first two sentences
        return sentences.slice(0, 2).join(' ').trim() || 'Emerging fashion trend gaining popularity.';
    }

    // Determine trend category based on content analysis
    determineTrendCategory(content) {
        const contentLower = content.toLowerCase();
        const categoryScores = {};
        
        // Calculate scores for each category
        for (const [cat, keywords] of Object.entries(this.trendKeywords)) {
            categoryScores[cat] = keywords.filter(keyword => contentLower.includes(keyword)).length;
        }
        
        // Find the category with the highest score
        let maxScore = 0;
        let category = 'style'; // default
        
        for (const [cat, score] of Object.entries(categoryScores)) {
            if (score > maxScore) {
                maxScore = score;
                category = cat;
            }
        }
        
        // If the score is too low, try to determine by specific keywords
        if (maxScore <= 1) {
            if (contentLower.match(/\b(red|blue|green|yellow|pink|black|white|grey|gray|purple|orange)\b/)) {
                category = 'color';
            } else if (contentLower.match(/\b(dress|shirt|pants|skirt|jacket|coat|shoes|bag|accessory)\b/)) {
                category = 'silhouette';
            } else if (contentLower.match(/\b(cotton|silk|wool|leather|denim|fabric)\b/)) {
                category = 'material';
            }
        }

        return category;
    }

    // Calculate momentum score (0-100)
    calculateMomentumScore(content, socialReach) {
        // Factors: mentions frequency, social reach, event associations
        const mentionScore = Math.min((content.match(/trend|trending|popular|new/gi) || []).length * 5, 30);
        const eventScore = (content.match(/fashion week|festival|gala|premiere|concert/gi) || []).length * 10;
        const socialScore = Math.min(socialReach / 100000 * 20, 40); // Normalize social reach
        
        return Math.min(mentionScore + eventScore + socialScore + Math.random() * 10, 100);
    }

    // Calculate velocity (rate of growth)
    calculateVelocity(content, momentumScore) {
        const growthKeywords = ['exploding', 'viral', 'rapidly', 'quickly', 'surging', 'skyrocketing'];
        const growthMentions = growthKeywords.filter(keyword => content.toLowerCase().includes(keyword)).length;
        
        // Base velocity on momentum and growth indicators
        return Math.min((momentumScore / 10) + (growthMentions * 5) + Math.random() * 5, 20);
    }

    // Determine lifecycle stage
    determineLifecycleStage(content, momentumScore, velocity) {
        const contentLower = content.toLowerCase();
        
        // Check for specific lifecycle keywords
        for (const [stage, keywords] of Object.entries(this.lifecycleKeywords)) {
            const matches = keywords.filter(keyword => contentLower.includes(keyword)).length;
            if (matches >= 2) return stage;
        }

        // Fallback to metrics-based determination
        if (velocity > 15 && momentumScore > 70) return 'emerging';
        if (velocity > 10 && momentumScore > 50) return 'growing';
        if (velocity < 5 && momentumScore > 60) return 'peak';
        if (velocity < 3 && momentumScore < 40) return 'declining';
        return 'dormant';
    }

    // Calculate adoption rate (0-1)
    calculateAdoptionRate(content, lifecycleStage) {
        const adoptionKeywords = ['wearing', 'spotted', 'seen in', 'rocking', 'sporting', 'embracing'];
        const adoptionMentions = adoptionKeywords.filter(keyword => content.toLowerCase().includes(keyword)).length;
        
        const baseRate = {
            emerging: 0.1 + Math.random() * 0.2,
            growing: 0.3 + Math.random() * 0.3,
            peak: 0.6 + Math.random() * 0.3,
            declining: 0.4 + Math.random() * 0.2,
            dormant: 0.05 + Math.random() * 0.1
        };

        return Math.min(baseRate[lifecycleStage] + (adoptionMentions * 0.05), 1);
    }

    // Extract demographic segments
    extractDemographicSegments(content) {
        const segments = {
            ageGroups: [],
            gender: [],
            location: [],
            incomeLevel: []
        };

        // Age groups
        if (content.match(/gen z|teens|young|youth/i)) segments.ageGroups.push('16-24');
        if (content.match(/millennials|20s|30s/i)) segments.ageGroups.push('25-34');
        if (content.match(/middle.?aged|40s|50s/i)) segments.ageGroups.push('35-54');
        if (content.match(/mature|senior|60s|older/i)) segments.ageGroups.push('55+');
        
        // Default if none found
        if (segments.ageGroups.length === 0) segments.ageGroups.push('18-34');

        // Gender
        if (content.match(/women|female|feminine|ladies/i)) segments.gender.push('female');
        if (content.match(/men|male|masculine|guys/i)) segments.gender.push('male');
        if (content.match(/unisex|gender.?neutral|everyone/i)) segments.gender.push('unisex');
        
        if (segments.gender.length === 0) segments.gender.push('unisex');

        // Location (looking for cities/regions)
        const locations = content.match(/(New York|Paris|Milan|London|Tokyo|LA|Los Angeles|Miami|global|worldwide)/gi) || [];
        segments.location = [...new Set(locations.map(loc => loc.toLowerCase()))];
        if (segments.location.length === 0) segments.location.push('global');

        // Income level
        if (content.match(/luxury|high.?end|expensive|designer|couture/i)) segments.incomeLevel.push('high');
        if (content.match(/affordable|budget|accessible|mid.?range/i)) segments.incomeLevel.push('medium');
        if (content.match(/fast fashion|cheap|low.?cost/i)) segments.incomeLevel.push('low');
        
        if (segments.incomeLevel.length === 0) segments.incomeLevel.push('medium');

        return segments;
    }

    // Calculate competitor adoption rate
    calculateCompetitorAdoption(content) {
        const brandMentions = (content.match(/Zara|H&M|Nike|Adidas|Gucci|Prada|Chanel|Dior|Forever 21|Shein|ASOS|Urban Outfitters/gi) || []).length;
        return Math.min(brandMentions * 0.15 + Math.random() * 0.2, 1);
    }

    // Calculate seasonality factor
    calculateSeasonalityFactor(content, trendIdentifier) {
        const seasonKeywords = {
            spring: ['spring', 'floral', 'pastel', 'light', 'fresh'],
            summer: ['summer', 'beach', 'bright', 'tropical', 'vacation'],
            fall: ['fall', 'autumn', 'cozy', 'layered', 'warm'],
            winter: ['winter', 'cold', 'holiday', 'festive', 'wool']
        };

        let seasonScore = 0;
        for (const [season, keywords] of Object.entries(seasonKeywords)) {
            const matches = keywords.filter(keyword => content.toLowerCase().includes(keyword)).length;
            if (matches > seasonScore) {
                seasonScore = matches;
            }
        }

        // Higher score means more seasonal dependency
        return Math.min((seasonScore * 0.25) + 0.3, 1);
    }

    // Predict peak and decline dates
    predictTrendDates(lifecycleStage, velocity, seasonalityFactor) {
        const today = new Date();
        let peakDate, declineDate;

        switch (lifecycleStage) {
            case 'emerging':
                // Peak in 2-4 months, decline in 6-12 months
                peakDate = new Date(today.getTime() + (60 + Math.random() * 60) * 24 * 60 * 60 * 1000);
                declineDate = new Date(today.getTime() + (180 + Math.random() * 180) * 24 * 60 * 60 * 1000);
                break;
            case 'growing':
                // Peak in 1-2 months, decline in 4-8 months
                peakDate = new Date(today.getTime() + (30 + Math.random() * 30) * 24 * 60 * 60 * 1000);
                declineDate = new Date(today.getTime() + (120 + Math.random() * 120) * 24 * 60 * 60 * 1000);
                break;
            case 'peak':
                // Already at peak, decline in 2-4 months
                peakDate = today;
                declineDate = new Date(today.getTime() + (60 + Math.random() * 60) * 24 * 60 * 60 * 1000);
                break;
            case 'declining':
            case 'dormant':
                // Past peak
                peakDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
                declineDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                break;
        }

        // Adjust for velocity
        const velocityAdjustment = (20 - velocity) * 3; // Days adjustment
        peakDate = new Date(peakDate.getTime() + velocityAdjustment * 24 * 60 * 60 * 1000);
        declineDate = new Date(declineDate.getTime() + velocityAdjustment * 24 * 60 * 60 * 1000);

        return {
            peakDate: peakDate.toISOString().split('T')[0],
            declineDate: declineDate.toISOString().split('T')[0]
        };
    }

    // Calculate social reach from content
    extractSocialReach(content) {
        // Extract numbers related to followers, views, likes, etc.
        const numbers = content.match(/(\d+)([kKmM]?)\s*(followers|views|likes|shares|comments)/gi) || [];
        let totalReach = 0;

        numbers.forEach(match => {
            const num = match.match(/(\d+)([kKmM]?)/);
            if (num) {
                let value = parseInt(num[1]);
                if (num[2]?.toLowerCase() === 'k') value *= 1000;
                if (num[2]?.toLowerCase() === 'm') value *= 1000000;
                totalReach += value;
            }
        });

        // Add random factor if no specific numbers found
        if (totalReach === 0) {
            totalReach = Math.floor(Math.random() * 500000) + 10000;
        }

        return totalReach;
    }

    // Calculate conversion impact
    calculateConversionImpact(momentumScore, adoptionRate, competitorAdoption) {
        // Based on momentum, adoption, and competitor activity
        return (momentumScore / 100 * 0.4) + (adoptionRate * 0.4) + (competitorAdoption * 0.2);
    }

    // Calculate risk score
    calculateRiskScore(lifecycleStage, velocity, seasonalityFactor, competitorAdoption) {
        let baseRisk = {
            emerging: 0.7,    // High risk, unproven
            growing: 0.5,     // Medium risk
            peak: 0.3,        // Low risk, proven
            declining: 0.6,   // Medium-high risk
            dormant: 0.8      // High risk
        };

        let risk = baseRisk[lifecycleStage];
        
        // Adjust for velocity (high velocity = higher risk)
        risk += (velocity / 100) * 0.2;
        
        // Adjust for seasonality (high seasonality = higher risk)
        risk += seasonalityFactor * 0.1;
        
        // Adjust for competitor adoption (high adoption = lower risk)
        risk -= competitorAdoption * 0.2;

        return Math.max(0, Math.min(risk, 1));
    }

    // Main analysis function
    async analyzeTrend(trendIdentifier, content) {
        const category = this.determineTrendCategory(content);
        const socialReach = this.extractSocialReach(content);
        const momentumScore = this.calculateMomentumScore(content, socialReach);
        const velocity = this.calculateVelocity(content, momentumScore);
        const lifecycleStage = this.determineLifecycleStage(content, momentumScore, velocity);
        const adoptionRate = this.calculateAdoptionRate(content, lifecycleStage);
        const demographicSegments = this.extractDemographicSegments(content);
        const competitorAdoption = this.calculateCompetitorAdoption(content);
        const seasonalityFactor = this.calculateSeasonalityFactor(content, trendIdentifier);
        const { peakDate, declineDate } = this.predictTrendDates(lifecycleStage, velocity, seasonalityFactor);
        const conversionImpact = this.calculateConversionImpact(momentumScore, adoptionRate, competitorAdoption);
        const riskScore = this.calculateRiskScore(lifecycleStage, velocity, seasonalityFactor, competitorAdoption);
        
        // Process description with OpenAI
        const trendDescription = await this.processDescriptionWithOpenAI(trendIdentifier, content);

        return {
            trend_identifier: trendIdentifier,
            trend_category: category,
            trend_description: trendDescription,
            momentum_score: Math.round(momentumScore * 100) / 100,
            velocity: Math.round(velocity * 100) / 100,
            lifecycle_stage: lifecycleStage,
            adoption_rate: Math.round(adoptionRate * 1000) / 1000,
            demographic_segments: demographicSegments,
            competitor_adoption: Math.round(competitorAdoption * 1000) / 1000,
            seasonality_factor: Math.round(seasonalityFactor * 1000) / 1000,
            predicted_peak_date: peakDate,
            predicted_decline_date: declineDate,
            social_reach: socialReach,
            conversion_impact: Math.round(conversionImpact * 1000) / 1000,
            risk_score: Math.round(riskScore * 1000) / 1000
        };
    }

    // Process trend identifier with OpenAI to create clean name
    async processTrendIdentifier(rawIdentifier) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a fashion trend naming expert. Convert raw trend identifiers into proper, SEO-friendly trend names. Use title case, make it catchy and professional. Maximum 5 words.'
                        },
                        {
                            role: 'user',
                            content: `Convert this trend identifier into a clean trend name: "${rawIdentifier}"`
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 50
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.choices && response.data.choices[0]) {
                const cleanName = response.data.choices[0].message.content.trim();
                // Convert to identifier format (lowercase with hyphens)
                return cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
            }
        } catch (error) {
            console.error('OpenAI API error for identifier:', error.response?.data || error.message);
        }

        // Fallback: just clean up the existing identifier
        return rawIdentifier;
    }
}

module.exports = TrendAnalyzer; 