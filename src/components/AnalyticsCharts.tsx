import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { LineChart, ProgressChart } from 'react-native-chart-kit';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface VitalsChartProps {
  data: number[];
  labels: string[];
  theme: any;
}

export const VitalsTrendChart = ({ data, labels, theme }: VitalsChartProps) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>Heart Rate Trend (24h)</Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        width={width - Spacing.lg * 2}
        height={220}
        chartConfig={{
          backgroundColor: theme.card,
          backgroundGradientFrom: theme.card,
          backgroundGradientTo: theme.card,
          decimalPlaces: 0,
          color: (opacity = 1) => theme.vital,
          labelColor: (opacity = 1) => theme.muted,
          style: {
            borderRadius: BorderRadius.xl,
          },
          propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: theme.vital,
          }
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: BorderRadius.xl,
        }}
      />
    </View>
  );
};

interface AdherenceChartProps {
  score: number; // 0 to 1
  theme: any;
}

export const AdherenceScoreChart = ({ score, theme }: AdherenceChartProps) => {
  return (
    <View style={styles.container}>
      <Text style={[styles.chartTitle, { color: theme.text }]}>Medication Adherence</Text>
      <ProgressChart
        data={{
          labels: ["Taken"],
          data: [score]
        }}
        width={width - Spacing.lg * 2}
        height={220}
        strokeWidth={16}
        radius={32}
        chartConfig={{
          backgroundColor: theme.card,
          backgroundGradientFrom: theme.card,
          backgroundGradientTo: theme.card,
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          labelColor: (opacity = 1) => theme.muted,
        }}
        hideLegend={false}
        style={{
          marginVertical: 8,
          borderRadius: BorderRadius.xl,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
});
