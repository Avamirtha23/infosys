def generate_recommendations(
    hvac,
    lighting,
    plug,
    total_energy
):

    recommendations = []

    hvac_percentage = (
        hvac / total_energy
    ) * 100

    lighting_percentage = (
        lighting / total_energy
    ) * 100

    plug_percentage = (
        plug / total_energy
    ) * 100


    if hvac_percentage > 60:

        recommendations.append(
            "HVAC consumption is high. "
            "Optimize HVAC temperature settings "
            "and operating schedules."
        )


    if lighting_percentage > 25:

        recommendations.append(
            "Lighting consumption is high. "
            "Switch off unnecessary lights and "
            "optimize lighting schedules."
        )


    if plug_percentage > 20:

        recommendations.append(
            "Plug load consumption is high. "
            "Check electrical equipment and "
            "switch off unused devices."
        )


    if not recommendations:

        recommendations.append(
            "Energy consumption is within the "
            "expected range. Continue monitoring."
        )


    recommendations.append(
        "Monitor repeated energy anomalies "
        "to identify possible equipment or "
        "operational issues."
    )


    return recommendations