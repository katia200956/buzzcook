import { Text, TextStyle } from 'react-native';

// Renders **bold** fragments of a step line ("**Готово, коли** низ золотий").
export function Rich({ text, style, bold }: { text: string; style: TextStyle; bold: TextStyle }) {
  const parts = text.split('**');
  return (
    <Text style={style}>
      {parts.map((p, i) => (i % 2 ? <Text key={i} style={bold}>{p}</Text> : p))}
    </Text>
  );
}
