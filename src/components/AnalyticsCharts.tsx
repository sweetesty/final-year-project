import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { LineChart, ProgressChart, BarChart } from 'react-native-chart-kit';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface VitalsChartProps {
  data: number[];
  labels: string[];
  theme: any;
}

export const VitalsTrendChart = ({ data, labels, theme }: VitalsChartProps) => {
  return (
    <View style={styles.chartWrapper}>
      <LineChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        width={width - 48}
        height={200}
        chartConfig={{
          backgroundGradientFrom: 'rgba(255, 255, 255, 0)',
          backgroundGradientTo: 'rgba(255, 255, 255, 0)',
          decimalPlaces: 0,
          color: (opacity = 1) => theme.vital || '#10B981',
          labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          style: { borderRadius: 16 },
          propsForDots: {
            r: "4",
            strokeWidth: "2",
            stroke: "#fff",
          },
          propsForBackgroundLines: {
            strokeDasharray: '0',
            stroke: 'rgba(148, 163, 184, 0.1)',
          }
        }}
        bezier
        withInnerLines={true}
        withOuterLines={false}
        style={{
          marginVertical: 8,
          borderRadius: 16,
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
    <View style={styles.chartWrapper}>
      <ProgressChart
        data={{
          labels: ["Adherence"],
          data: [score]
        }}
        width={width - 64}
        height={160}
        strokeWidth={14}
        radius={48}
        chartConfig={{
          backgroundGradientFrom: 'rgba(255, 255, 255, 0)',
          backgroundGradientTo: 'rgba(255, 255, 255, 0)',
          color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          labelColor: (opacity = 1) => theme.muted,
        }}
        hideLegend={false}
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
};

export const FallFrequencyChart = ({ data, labels, theme }: VitalsChartProps) => {
  return (
    <View style={styles.chartWrapper}>
      <BarChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        width={width - 48}
        height={180}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={{
          backgroundGradientFrom: 'rgba(255, 255, 255, 0)',
          backgroundGradientTo: 'rgba(255, 255, 255, 0)',
          decimalPlaces: 0,
          color: (opacity = 1) => theme.emergency || '#EF4444',
          labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          barPercentage: 0.6,
          propsForBackgroundLines: {
            strokeDasharray: '4',
            stroke: 'rgba(148, 163, 184, 0.1)',
          }
        }}
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
        showValuesOnTopOfBars={true}
        fromZero={true}
      />
    </View>
  );
};

export const ActivityIntensityChart = ({ data, labels, theme }: VitalsChartProps) => {
  return (
    <View style={styles.chartWrapper}>
      <LineChart
        data={{
          labels,
          datasets: [{ data }],
        }}
        width={width - 48}
        height={180}
        chartConfig={{
          backgroundGradientFrom: 'rgba(255, 255, 255, 0)',
          backgroundGradientTo: 'rgba(255, 255, 255, 0)',
          decimalPlaces: 1,
          color: (opacity = 1) => theme.tint || '#6366F1',
          labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          propsForBackgroundLines: {
             strokeDasharray: '0',
             stroke: 'rgba(148, 163, 184, 0.05)',
          }
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
});
