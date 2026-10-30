
from pyspark.sql import SparkSession

spark = (
    SparkSession.builder
    .appName("DataOpsOne_OutputCheck")
    .master("local[*]")
    .getOrCreate()
)

spark.sparkContext.setLogLevel("ERROR")

valid_df = spark.read.parquet("output/valid_records")
rejected_df = spark.read.parquet("output/rejected_records")

print("\n--- OUTPUT VERIFICATION ---")
print("Valid Records:", valid_df.count())
print("Rejected Records:", rejected_df.count())

print("\n--- REJECTION REASONS SUMMARY ---")
rejected_df.groupBy("rejection_reason").count().show(truncate=False)

spark.stop()
