import pandas as pd
from sklearn.ensemble import IsolationForest
from recommendation import generate_recommendations


file_path = "data/2019Floor2.csv"

df = pd.read_csv(file_path)

print("========================================")
print("       AGENTIC FACILITYOPS")
print("          ENERGY AGENT")
print("========================================")

print("\nDataset loaded successfully!")

print("\nNumber of rows:", df.shape[0])
print("Number of columns:", df.shape[1])

print("\nFirst 5 rows:")
print(df.head())


print("\n========================================")
print("          DATA QUALITY CHECK")
print("========================================")

print("\nMissing values:")

missing_values = df.isnull().sum()

print(missing_values)

duplicates = df.duplicated().sum()

print("\nDuplicate rows:", duplicates)


df["Date"] = pd.to_datetime(df["Date"], errors="coerce")

df = df.dropna(subset=["Date"])

df = df.drop_duplicates()

numeric_columns = df.select_dtypes(include="number").columns

df[numeric_columns] = df[numeric_columns].interpolate()

df[numeric_columns] = df[numeric_columns].ffill()

df[numeric_columns] = df[numeric_columns].bfill()


print("\nData cleaning completed!")

print("Rows after cleaning:", df.shape[0])
print("Columns after cleaning:", df.shape[1])


hvac_columns = [
    column for column in df.columns
    if "_AC" in column
]

lighting_columns = [
    column for column in df.columns
    if "_Light" in column
]

plug_columns = [
    column for column in df.columns
    if "_Plug" in column
]


df["Total_HVAC_kW"] = df[hvac_columns].sum(axis=1)

df["Total_Lighting_kW"] = df[lighting_columns].sum(axis=1)

df["Total_Plug_kW"] = df[plug_columns].sum(axis=1)

df["Total_Energy_kW"] = (
    df["Total_HVAC_kW"]
    + df["Total_Lighting_kW"]
    + df["Total_Plug_kW"]
)


print("\n========================================")
print("          ENERGY ANALYSIS")
print("========================================")

print("\nTotal HVAC:",
      round(df["Total_HVAC_kW"].sum(), 2))

print("Total Lighting:",
      round(df["Total_Lighting_kW"].sum(), 2))

print("Total Plug:",
      round(df["Total_Plug_kW"].sum(), 2))

print("Total Energy:",
      round(df["Total_Energy_kW"].sum(), 2))


model = IsolationForest(
    contamination=0.05,
    random_state=42
)

df["Anomaly"] = model.fit_predict(
    df[["Total_Energy_kW"]]
)

df["Anomaly_Status"] = df["Anomaly"].map({
    1: "Normal",
    -1: "Anomaly"
})


anomaly_count = int(
    (df["Anomaly"] == -1).sum()
)

normal_count = len(df) - anomaly_count

anomaly_percentage = (
    anomaly_count / len(df)
) * 100


print("\n========================================")
print("       ENERGY ANOMALY DETECTION")
print("========================================")

print("\nTotal readings:", len(df))

print("Normal readings:", normal_count)

print("Anomalies detected:", anomaly_count)

print(
    "Anomaly percentage:",
    round(anomaly_percentage, 2),
    "%"
)


print("\nSample anomalies:")

sample_anomalies = df[
    df["Anomaly"] == -1
][
    [
        "Date",
        "Total_HVAC_kW",
        "Total_Lighting_kW",
        "Total_Plug_kW",
        "Total_Energy_kW",
        "Anomaly_Status"
    ]
].head(10)

print(sample_anomalies)


average_hvac = df["Total_HVAC_kW"].mean()

average_lighting = df["Total_Lighting_kW"].mean()

average_plug = df["Total_Plug_kW"].mean()

average_energy = df["Total_Energy_kW"].mean()


recommendations = generate_recommendations(
    average_hvac,
    average_lighting,
    average_plug,
    average_energy
)


print("\n========================================")
print("       ENERGY RECOMMENDATIONS")
print("========================================")

for recommendation in recommendations:
    print("\n- " + recommendation)


output_file = "data/cleaned_energy_data.csv"

df.to_csv(
    output_file,
    index=False
)


report_file = "energy_report.txt"

with open(report_file, "w") as file:

    file.write("AGENTIC FACILITYOPS\n")
    file.write("ENERGY AGENT REPORT\n")
    file.write("=" * 50 + "\n\n")

    file.write("Dataset: CU-BEMS 2019 Floor 2\n")
    file.write(f"Total Readings: {len(df)}\n")
    file.write(f"Normal Readings: {normal_count}\n")
    file.write(f"Anomalies Detected: {anomaly_count}\n")
    file.write(
        f"Anomaly Percentage: {anomaly_percentage:.2f}%\n\n"
    )

    file.write("ENERGY SUMMARY\n")
    file.write("-" * 30 + "\n")

    file.write(
        f"Total HVAC: "
        f"{df['Total_HVAC_kW'].sum():.2f}\n"
    )

    file.write(
        f"Total Lighting: "
        f"{df['Total_Lighting_kW'].sum():.2f}\n"
    )

    file.write(
        f"Total Plug: "
        f"{df['Total_Plug_kW'].sum():.2f}\n"
    )

    file.write(
        f"Total Energy: "
        f"{df['Total_Energy_kW'].sum():.2f}\n\n"
    )

    file.write("RECOMMENDATIONS\n")
    file.write("-" * 30 + "\n")

    for recommendation in recommendations:
        file.write(
            f"- {recommendation}\n"
        )


recommendation_file = "recommendations.txt"

with open(recommendation_file, "w") as file:

    file.write("ENERGY EFFICIENCY RECOMMENDATIONS\n")
    file.write("=" * 50 + "\n\n")

    for recommendation in recommendations:
        file.write(
            f"- {recommendation}\n"
        )


print("\n========================================")
print("              COMPLETED")
print("========================================")

print("\nCleaned dataset saved successfully!")

print("File:", output_file)

print("\nEnergy report generated successfully!")

print("File:", report_file)

print("\nRecommendations generated successfully!")

print("File:", recommendation_file)
