import React from 'react';
import { Redirect } from 'expo-router';

/**
 * Route handler for /product/ or /product
 * Automatically redirects customer to the categories catalog if no product ID is specified.
 */
export default function ProductIndexRoute() {
  return <Redirect href="/(tabs)/categories" />;
}
