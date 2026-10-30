
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, trim, expr, when, count, concat_ws
)
from pyspark.sql.window import Window

spark = (
    SparkSession.builder
    .appName("DataOpsOne_ETL")
    .master("local[*]")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")

print("\n========== DATAOPS ONE ETL PIPELINE ==========")

# 1. EXTRACT
df = (
    spark.read
    .option("header", True)
    .option("inferSchema", True)
    .csv("data/customers.csv")
)

source_count = df.count()

print("\n--- EXTRACTION SUMMARY ---")
print("Source Records:", source_count)

# 2. PREPARE DATA FOR VALIDATION
prepared_df = (
    df.withColumn("name", trim(col("name")))
      .withColumn("city", trim(col("city")))
      .withColumn("salary_num", expr("try_cast(salary AS DOUBLE)"))
)

# 3. CHECK DUPLICATE CUSTOMER IDs
window_spec = Window.partitionBy("customer_id")

prepared_df = prepared_df.withColumn(
    "id_count",
    count("*").over(window_spec)
)

# 4. VALIDATE RECORDS
validated_df = prepared_df.withColumn(
    "rejection_reason",
    concat_ws(
        " | ",
        when(col("customer_id").isNull(), "Missing customer ID"),
        when(col("id_count") > 1, "Duplicate customer ID"),
        when(
            col("name").isNull() | (col("name") == ""),
            "Missing customer name"
        ),
        when(col("salary_num").isNull(), "Invalid or missing salary"),
        when(col("salary_num") < 0, "Negative salary")
    )
)

# 5. SEPARATE VALID AND REJECTED RECORDS
valid_df = validated_df.filter(col("rejection_reason") == "")

rejected_df = validated_df.filter(col("rejection_reason") != "")

valid_count = valid_df.count()
rejected_count = rejected_df.count()

# 6. SAVE VALID AND REJECTED RECORDS

valid_output = "output/valid_records"
rejected_output = "output/rejected_records"

# Save valid records
(
    valid_df.select(
        "customer_id", "name", "city", "salary"
    )
    .write
    .mode("overwrite")
    .parquet(valid_output)
)

# Save rejected records with rejection reasons
(
    rejected_df.select(
        "customer_id",
        "name",
        "city",
        "salary",
        "rejection_reason"
    )
    .write
    .mode("overwrite")
    .parquet(rejected_output)
)

print("\n--- OUTPUT SUMMARY ---")
print("Valid records saved:", valid_count)
print("Rejected records saved:", rejected_count)
print("Valid output:", valid_output)
print("Rejected output:", rejected_output)


# 6. DISPLAY SUMMARY ONLY
print("\n--- DATA VALIDATION SUMMARY ---")
print("Total Records:", source_count)
print("Valid Records:", valid_count)
print("Rejected Records:", rejected_count)

print("\n--- PIPELINE STATUS ---")

if rejected_count > 0:
    print("WARNING: Invalid records detected")
else:
    print("SUCCESS: All records passed validation")

print("\n========== PIPELINE COMPLETED ==========")

spark.stop()
